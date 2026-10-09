// app.js - Main Application Controller for Transport Fever 3 Telemetry
class TF3App {
  constructor() {
    this.ws = null;
    this.currentData = null;
    this.lines = [];

    // Sub-components
    this.chart = new window.TelemetryChart('telemetryChartCanvas');
    this.warnings = new window.WarningEngine('warningsListContainer');
    this.routes = new window.RouteExplorer('routesGridContainer');
    this.matrix = new window.CityMatrix('cityMatrixTable');
    this.tablet = new window.TabletManager();

    this.initTabs();
    this.initWebSocket();
    this.fetchInitialData();
  }

  initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        if (!targetTab) return;

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const panel = document.getElementById(targetTab);
        if (panel) panel.classList.add('active');

        // Re-render chart if switching to chart tab
        if (targetTab === 'tab-chart' && this.chart) {
          setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
          }, 50);
        }
      });
    });
  }

  async fetchInitialData() {
    try {
      const res = await fetch('/api/telemetry/live');
      if (res.ok) {
        const data = await res.json();
        this.handleTelemetryUpdate(data);
      }
    } catch (e) {
      console.warn('Initial data load error:', e);
    }
  }

  initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const connect = () => {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.updateGameStatus(true, 'TF3 Live verbunden');
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'TELEMETRY_UPDATE' && msg.data) {
            this.handleTelemetryUpdate(msg.data, msg.gameState);
          }
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this.updateGameStatus(false, 'Verbindung getrennt (Reconnecting...)');
        setTimeout(connect, 3000);
      };

      this.ws.onerror = () => {
        this.updateGameStatus(false, 'Verbindungsfehler');
      };
    };

    connect();
  }

  handleTelemetryUpdate(data, gameState) {
    if (!data) return;
    this.currentData = data;
    this.lines = data.lines || [];

    // 1. Update KPIs
    const kpiNet = document.getElementById('kpiNetworkUtil');
    if (kpiNet) {
      kpiNet.textContent = `${Math.round(data.overallUtilization || 0)}%`;
    }

    const kpiFleet = document.getElementById('kpiFleetCount');
    if (kpiFleet) {
      const totalVehicles = data.totalVehicles || this.lines.reduce((acc, l) => acc + (l.vehicleCount !== undefined ? l.vehicleCount : (l.vehicles ? l.vehicles.length : 0)), 0);
      kpiFleet.textContent = totalVehicles;
    }

    // 2. Update Subsystems
    if (this.chart) {
      this.chart.setLines(this.lines);
      this.chart.updateData(data);
    }

    if (this.warnings) {
      this.warnings.update(this.lines);
    }

    if (this.routes) {
      this.routes.update(this.lines);
    }

    if (this.matrix) {
      this.matrix.update(this.lines);
    }

    // 3. Game state & Savegame info indicator
    const effectiveState = gameState || data.gameState;
    if (effectiveState) {
      if (effectiveState.activeSave) {
        const saveEl = document.getElementById('activeSaveName');
        if (saveEl) saveEl.textContent = effectiveState.activeSave;
      }

      const syncEl = document.getElementById('lastSyncLabel');
      if (syncEl) {
        const d = new Date();
        syncEl.textContent = `(Zuletzt aktualisiert: ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')})`;
      }

      if (effectiveState.processRunning) {
        this.updateGameStatus(true, `TF3 läuft (PID ${effectiveState.processId || 'aktiv'})`);
      } else {
        this.updateGameStatus(false, 'Spiel nicht gestartet', 'pulse-warning');
      }
    }
  }

  async triggerSync() {
    const btn = document.getElementById('btnSyncNow');
    const icon = document.getElementById('syncIcon');
    const label = document.getElementById('syncLabel');

    if (icon) icon.style.animation = 'spin 0.8s linear infinite';
    if (label) label.textContent = 'Lese ein...';

    try {
      const res = await fetch('/api/telemetry/refresh', { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        if (label) label.textContent = `${result.linesCount || 46} Linien synchronisiert!`;
        setTimeout(() => {
          if (label) label.textContent = 'Live-Sync';
        }, 2500);
      }
    } catch (e) {
      if (label) label.textContent = 'Fehler!';
      setTimeout(() => {
        if (label) label.textContent = 'Live-Sync';
      }, 2500);
    } finally {
      if (icon) icon.style.animation = '';
    }
  }

  updateGameStatus(connected, label, pulseClass = '') {
    const el = document.getElementById('gameStatusIndicator');
    if (!el) return;

    const dot = el.querySelector('.pulse-dot');
    const val = el.querySelector('.status-val');

    if (dot) {
      dot.className = 'pulse-dot ' + pulseClass;
      if (!connected && !pulseClass) {
        dot.classList.add('pulse-error');
      }
    }

    if (val) {
      val.textContent = label;
    }
  }

  inspectLine(lineId) {
    const line = this.lines.find(l => l.id === lineId);
    if (!line) return;

    const modal = document.getElementById('lineDetailModal');
    const title = document.getElementById('lineModalTitle');
    const content = document.getElementById('lineModalContent');
    if (!modal || !content) return;

    title.innerHTML = `
      <span style="color: ${line.color || 'var(--accent-cyan)'};">●</span>
      ${line.name} <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">(${line.cargoType || 'Fracht'})</span>
    `;

    const utilPercent = Math.round(line.utilization);
    const vehicles = line.vehicles || [
      { id: 'v1', name: 'Fahrzeug #1', load: 0, capacity: 10, status: 'Im Einsatz' },
      { id: 'v2', name: 'Fahrzeug #2', load: 0, capacity: 10, status: 'Im Einsatz' }
    ];

    content.innerHTML = `
      <div class="inspector-detail-grid">
        <div class="inspector-card">
          <div class="stat-label">Aktuelle Auslastung</div>
          <div class="stat-val" style="color: ${utilPercent === 0 ? 'var(--status-rose)' : 'var(--accent-cyan)'};">
            ${utilPercent}%
          </div>
          <div class="progress-track">
            <div class="progress-bar-fill" style="width: ${Math.max(4, utilPercent)}%; background: ${utilPercent === 0 ? 'var(--status-rose)' : 'var(--accent-cyan)'};"></div>
          </div>
        </div>

        <div class="inspector-card">
          <div class="stat-label">Fracht / Kapazität</div>
          <div class="stat-val">${line.load} / ${line.capacity}</div>
          <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 4px;">Kapazität pro Umlauf</div>
        </div>

        <div class="inspector-card">
          <div class="stat-label">Soll-Taktung / Headway</div>
          <div class="stat-val">~${line.frequency || 90}s</div>
          <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 4px;">Abstand zwischen Fahrzeugen</div>
        </div>

        <div class="inspector-card">
          <div class="stat-label">Rhythmus-Status</div>
          <div class="stat-val" style="font-size: 0.95rem; color: ${line.rhythmStatus === 'GHOST_LINE' ? 'var(--status-rose)' : (line.rhythmStatus === 'BUNCHING' ? 'var(--status-amber)' : 'var(--status-emerald)')};">
            ${line.rhythmStatus === 'GHOST_LINE' ? '👻 0% Geisterlinie' : (line.rhythmStatus === 'BUNCHING' ? '⚠️ Pulkbildung' : '✅ Gleichmäßig')}
          </div>
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <h4 style="font-size: 0.88rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">
          🚏 Haltestellen-Sequenz
        </h4>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${(line.stops || []).map((stop, i) => `
            <div style="background: rgba(255,255,255,0.06); padding: 6px 12px; border-radius: var(--radius-sm); font-size: 0.82rem; border: 1px solid var(--border-subtle);">
              <span style="color: var(--accent-cyan); font-weight: 700;">#${i+1}</span> ${stop}
            </div>
          `).join('')}
        </div>
      </div>

      <div>
        <h4 style="font-size: 0.88rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">
          🚚 Zugewiesene LKW / Fuhrwerke (${vehicles.length})
        </h4>
        <div class="vehicle-list">
          ${vehicles.map(v => `
            <div class="vehicle-item">
              <div>
                <strong>${v.name}</strong>
                <div style="font-size: 0.75rem; color: var(--text-dim);">${v.status || 'Unterwegs'}</div>
              </div>
              <div style="text-align: right; font-family: var(--font-mono);">
                <span style="font-weight: 700; color: ${v.load === 0 ? 'var(--status-rose)' : 'var(--status-emerald)'};">
                  ${v.load} / ${v.capacity} Ladung
                </span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    modal.classList.add('open');
  }

  closeLineModal() {
    const modal = document.getElementById('lineDetailModal');
    if (modal) modal.classList.remove('open');
  }

  openSetupModal() {
    const modal = document.getElementById('setupModal');
    if (modal) modal.classList.add('open');
  }

  closeSetupModal() {
    const modal = document.getElementById('setupModal');
    if (modal) modal.classList.remove('open');
  }
}

// Bootstrap once DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new TF3App();
});
