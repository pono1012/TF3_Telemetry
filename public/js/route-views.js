// route-views.js - Route Explorer & Real-Time Cards Grid
class RouteExplorer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.searchInput = document.getElementById('routeSearchInput');
    this.routesBadge = document.getElementById('tabRoutesBadge');

    this.allLines = [];
    this.activeCarrier = 'ALL';
    this.activeStatus = 'ALL';
    this.searchTerm = '';

    this.initFilters();
  }

  initFilters() {
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value.toLowerCase().trim();
        this.render();
      });
    }

    document.querySelectorAll('.carrier-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.carrier-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeCarrier = btn.dataset.carrier;
        this.render();
      });
    });

    document.querySelectorAll('.status-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.status-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeStatus = btn.dataset.status;
        this.render();
      });
    });
  }

  update(lines) {
    this.allLines = lines || [];
    if (this.routesBadge) {
      this.routesBadge.textContent = this.allLines.length;
    }
    this.render();
  }

  render() {
    if (!this.container) return;

    let filtered = this.allLines.filter(line => {
      // Search filter
      if (this.searchTerm) {
        const nameMatch = line.name.toLowerCase().includes(this.searchTerm);
        const cityMatch = line.cityPair && line.cityPair.toLowerCase().includes(this.searchTerm);
        const stopMatch = line.stops && line.stops.some(s => s.toLowerCase().includes(this.searchTerm));
        if (!nameMatch && !cityMatch && !stopMatch) return false;
      }

      // Carrier filter
      if (this.activeCarrier === 'TRUCK' && line.vehicleCategory !== 'TRUCK_CARGO') return false;
      if (this.activeCarrier === 'BUS' && line.vehicleCategory !== 'BUS_PASSENGER') return false;

      // Status filter
      if (this.activeStatus === 'WARNINGS') {
        const hasWarn = (line.warnings && line.warnings.length > 0) || line.utilization === 0 || line.rhythmStatus === 'BUNCHING';
        if (!hasWarn) return false;
      }
      const vCount = line.vehicleCount !== undefined ? line.vehicleCount : (line.vehicles ? line.vehicles.length : 0);
      if (this.activeStatus === 'ACTIVE') {
        if (vCount === 0) return false;
      }
      if (this.activeStatus === 'INACTIVE') {
        if (vCount !== 0 && line.rhythmStatus !== 'INACTIVE') return false;
      }
      if (this.activeStatus === 'GHOST') {
        if (line.rhythmStatus !== 'GHOST_LINE') return false;
      }
      if (this.activeStatus === 'BUNCHING') {
        if (line.rhythmStatus !== 'BUNCHING' && (!line.rhythmScore || line.rhythmScore >= 70)) return false;
      }
      if (this.activeStatus === 'OPTIMAL') {
        if (vCount === 0 || line.rhythmStatus === 'GHOST_LINE' || line.rhythmStatus === 'BUNCHING') return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      this.container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-dim); background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-subtle);">
          Keine passenden Straßenrouten gefunden für die gewählten Filter.
        </div>
      `;
      return;
    }

    this.container.innerHTML = filtered.map(line => {
      const vCount = line.vehicleCount !== undefined ? line.vehicleCount : (line.vehicles ? line.vehicles.length : 0);
      const isInactive = vCount === 0 || line.rhythmStatus === 'INACTIVE';
      const utilPercent = isInactive ? 0 : Math.round(line.utilization);

      let barColor = 'var(--accent-cyan)';
      let statusBadge = `<span class="warning-badge badge-success">Optimal (${vCount} Fzg)</span>`;

      if (isInactive) {
        barColor = '#64748b';
        statusBadge = '<span class="warning-badge" style="background: rgba(100, 116, 139, 0.2); color: #94a3b8; border: 1px solid rgba(100, 116, 139, 0.3);">⚪ 0 Fahrzeuge</span>';
      } else if (line.rhythmStatus === 'GHOST_LINE' || line.utilization === 0) {
        barColor = 'var(--status-rose)';
        statusBadge = `<span class="warning-badge badge-critical">👻 0% Leerfahrt (${vCount} LKW)</span>`;
      } else if (line.rhythmStatus === 'BUNCHING' || (line.rhythmScore && line.rhythmScore < 60)) {
        barColor = 'var(--status-amber)';
        statusBadge = `<span class="warning-badge badge-warning">⚠️ Pulkbildung (${vCount} Fzg)</span>`;
      } else if (line.utilization > 80) {
        barColor = 'var(--status-purple)';
        statusBadge = `<span class="warning-badge" style="background: rgba(139, 92, 246, 0.2); color: var(--status-purple);">Hohe Last (${vCount} Fzg)</span>`;
      }

      const vehicleCount = vCount;
      const stopsDisplay = line.stops ? line.stops.join(' ➔ ') : '2 Stationen';

      return `
        <div class="route-card" style="--route-color: ${line.color || 'var(--accent-cyan)'};" onclick="window.app.inspectLine('${line.id}')">
          <div class="route-card-header">
            <div>
              <div class="route-name">
                <span>${line.vehicleCategory === 'BUS_PASSENGER' ? '🚌' : '🚚'}</span>
                <span>${line.name}</span>
              </div>
              <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
                ${line.cargoType || 'Fracht'} • ${line.cityPair || 'Straßenverbindung'}
              </div>
            </div>
            <div>
              ${statusBadge}
            </div>
          </div>

          <div style="font-size: 0.76rem; color: var(--text-dim); margin-bottom: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${stopsDisplay}">
            🚏 ${stopsDisplay}
          </div>

          <div class="route-stats-grid">
            <div class="stat-item">
              <div class="stat-label">Auslastung</div>
              <div class="stat-val" style="color: ${barColor};">${utilPercent}%</div>
              <div class="progress-track">
                <div class="progress-bar-fill" style="width: ${Math.min(100, Math.max(4, utilPercent))}%; background: ${barColor};"></div>
              </div>
            </div>

            <div class="stat-item">
              <div class="stat-label">Fracht / Kapazität</div>
              <div class="stat-val">${line.load} / ${line.capacity}</div>
              <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 4px;">
                ${vehicleCount} Fahrzeuge
              </div>
            </div>
          </div>

          <div class="route-footer">
            <span>⏱️ Takt: ~${line.frequency || 90}s</span>
            <span style="color: var(--accent-cyan); font-weight: 600;">Details ➔</span>
          </div>
        </div>
      `;
    }).join('');
  }
}

window.RouteExplorer = RouteExplorer;
