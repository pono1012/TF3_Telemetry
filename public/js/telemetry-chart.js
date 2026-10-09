// telemetry-chart.js - Canvas-based High Performance Telemetry Chart for TF3
class TelemetryChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.minutesRange = 15;
    this.historyData = {};
    this.lines = [];
    this.selectedLines = new Set();
    this.hoverPoint = null;

    this.initCanvasResize();
    this.initEvents();
  }

  initCanvasResize() {
    const resize = () => {
      if (!this.canvas || !this.canvas.parentElement) return;
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.width = rect.width;
      this.height = rect.height;
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.ctx.resetTransform?.();
      this.ctx.scale(dpr, dpr);
      this.render();
    };

    window.addEventListener('resize', resize);
    setTimeout(resize, 50);
  }

  initEvents() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      this.findHoverPoint(mouseX, mouseY);
      this.render();
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoverPoint = null;
      this.render();
    });

    // Time window buttons
    document.querySelectorAll('.time-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.minutesRange = parseInt(btn.dataset.minutes || '15', 10);
        this.fetchHistory();
      });
    });
  }

  setLines(lines) {
    this.lines = lines;
    // Default: select the top active trunk lines and ghost line
    if (this.selectedLines.size === 0) {
      const activeSorted = [...lines].filter(l => (l.vehicleCount || 0) > 0).sort((a, b) => (b.vehicleCount || 0) - (a.vehicleCount || 0));
      activeSorted.slice(0, 4).forEach(l => this.selectedLines.add(l.id));
      const ghost = lines.find(l => l.rhythmStatus === 'GHOST_LINE');
      if (ghost) this.selectedLines.add(ghost.id);
      if (this.selectedLines.size === 0) {
        lines.slice(0, 5).forEach(l => this.selectedLines.add(l.id));
      }
    }
    this.renderLinePills();
  }

  renderLinePills() {
    const container = document.getElementById('chartLinePillsContainer');
    if (!container) return;

    container.innerHTML = this.lines.map(line => {
      const isSelected = this.selectedLines.has(line.id);
      const vCount = line.vehicleCount !== undefined ? line.vehicleCount : (line.vehicles ? line.vehicles.length : 0);
      return `
        <div class="line-toggle-pill ${isSelected ? 'active' : ''}" 
             data-id="${line.id}" 
             style="--pill-color: ${line.color};"
             onclick="window.app.chart.toggleLine('${line.id}')">
          <span class="line-color-dot"></span>
          <span>${line.name}</span>
          <span style="font-family: var(--font-mono); font-size: 0.72rem; opacity: 0.75;">
            (${vCount} Fzg: ${Math.round(line.utilization)}%)
          </span>
        </div>
      `;
    }).join('');
  }

  toggleLine(lineId) {
    if (this.selectedLines.has(lineId)) {
      if (this.selectedLines.size > 1) {
        this.selectedLines.delete(lineId);
      }
    } else {
      this.selectedLines.add(lineId);
    }
    this.renderLinePills();
    this.render();
  }

  updateData(telemetryUpdate) {
    if (!telemetryUpdate || !telemetryUpdate.lines) return;
    const now = Date.now();

    telemetryUpdate.lines.forEach(line => {
      if (!this.historyData[line.id]) {
        this.historyData[line.id] = [];
      }
      this.historyData[line.id].push({
        time: now,
        utilization: line.utilization,
        load: line.load,
        name: line.name,
        color: line.color
      });

      // Keep within max window
      const cutoff = now - (60 * 60 * 1000);
      while (this.historyData[line.id].length > 0 && this.historyData[line.id][0].time < cutoff) {
        this.historyData[line.id].shift();
      }
    });

    this.render();
  }

  async fetchHistory() {
    try {
      const res = await fetch(`/api/telemetry/history?minutes=${this.minutesRange}`);
      if (res.ok) {
        const data = await res.json();
        for (const [id, points] of Object.entries(data)) {
          this.historyData[id] = points;
        }
        this.render();
      }
    } catch (e) {
      console.warn('History fetch error', e);
    }
  }

  findHoverPoint(mx, my) {
    const padding = { top: 30, right: 30, bottom: 40, left: 50 };
    const chartW = this.width - padding.left - padding.right;
    const chartH = this.height - padding.top - padding.bottom;
    const now = Date.now();
    const startTime = now - (this.minutesRange * 60 * 1000);

    let closest = null;
    let minDistance = 25;

    this.selectedLines.forEach(lineId => {
      const points = this.historyData[lineId] || [];
      const lineMeta = this.lines.find(l => l.id === lineId);
      if (!lineMeta) return;

      points.forEach(pt => {
        if (pt.time < startTime) return;
        const x = padding.left + ((pt.time - startTime) / (now - startTime)) * chartW;
        const y = padding.top + chartH - (pt.utilization / 100) * chartH;

        const dist = Math.hypot(mx - x, my - y);
        if (dist < minDistance) {
          minDistance = dist;
          closest = { x, y, pt, meta: lineMeta };
        }
      });
    });

    this.hoverPoint = closest;
  }

  render() {
    if (!this.ctx || !this.width || !this.height) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    const pad = { top: 30, right: 30, bottom: 40, left: 50 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    ctx.clearRect(0, 0, w, h);

    // Background grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '11px JetBrains Mono, monospace';

    // Horizontal Y-axis lines (0%, 25%, 50%, 75%, 100%)
    const ySteps = [0, 25, 50, 75, 100];
    ySteps.forEach(val => {
      const y = pad.top + chartH - (val / 100) * chartH;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();

      ctx.textAlign = 'right';
      ctx.fillText(`${val}%`, pad.left - 10, y + 4);
    });

    // 5-minute Systemic Reaction Band highlight
    const now = Date.now();
    const startTime = now - (this.minutesRange * 60 * 1000);
    const fiveMinTime = now - (5 * 60 * 1000);
    if (fiveMinTime > startTime) {
      const bandX = pad.left + ((fiveMinTime - startTime) / (now - startTime)) * chartW;
      const bandWidth = (w - pad.right) - bandX;

      ctx.fillStyle = 'rgba(6, 182, 212, 0.04)';
      ctx.fillRect(bandX, pad.top, bandWidth, chartH);

      ctx.fillStyle = 'rgba(6, 182, 212, 0.4)';
      ctx.textAlign = 'right';
      ctx.fillText('◄ 5 Min Reaktionsfenster', w - pad.right - 8, pad.top + 16);
    }

    // Time X-axis labels
    const timeSteps = 5;
    for (let i = 0; i <= timeSteps; i++) {
      const frac = i / timeSteps;
      const x = pad.left + frac * chartW;
      const t = new Date(startTime + frac * (now - startTime));
      const timeStr = `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + chartH);
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#64748b';
      ctx.fillText(timeStr, x, h - pad.bottom + 20);
    }

    // Draw active lines
    this.selectedLines.forEach(lineId => {
      const points = this.historyData[lineId] || [];
      const lineMeta = this.lines.find(l => l.id === lineId);
      if (!lineMeta || points.length < 2) return;

      const validPoints = points.filter(p => p.time >= startTime);
      if (validPoints.length === 0) return;

      const color = lineMeta.color || '#06b6d4';

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      validPoints.forEach((pt, idx) => {
        const x = pad.left + ((pt.time - startTime) / (now - startTime)) * chartW;
        const y = pad.top + chartH - (pt.utilization / 100) * chartH;
        if (idx === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      // Subtle glow
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.restore();
    });

    // Tooltip / Hover Point
    if (this.hoverPoint) {
      const { x, y, pt, meta } = this.hoverPoint;

      // Indicator dot
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = meta.color || '#38bdf8';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Tooltip Card
      const ttText1 = `${meta.name}`;
      const ttText2 = `Auslastung: ${Math.round(pt.utilization)}% (${pt.load || 0} Einheiten)`;
      const ttW = Math.max(ctx.measureText(ttText1).width, ctx.measureText(ttText2).width) + 24;
      const ttH = 46;
      let ttX = x + 12;
      let ttY = y - 24;
      if (ttX + ttW > w - 10) ttX = x - ttW - 12;
      if (ttY < 10) ttY = 10;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = meta.color || 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(ttX, ttY, ttW, ttH, 6) : ctx.rect(ttX, ttY, ttW, ttH);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(ttText1, ttX + 12, ttY + 18);

      ctx.fillStyle = meta.color || '#38bdf8';
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.fillText(ttText2, ttX + 12, ttY + 36);
    }
  }
}

window.TelemetryChart = TelemetryChart;
