// city-matrix.js - City-to-City and Hub Connection Matrix
class CityMatrix {
  constructor(tableId) {
    this.table = document.getElementById(tableId);
  }

  update(lines) {
    if (!this.table || !lines) return;
    const tbody = this.table.querySelector('tbody');
    if (!tbody) return;

    // Group lines by cityPair or endpoints
    const pairMap = {};

    lines.forEach(line => {
      const pair = line.cityPair || 'Straßenverbindung';
      if (!pairMap[pair]) {
        pairMap[pair] = {
          name: pair,
          lines: [],
          totalCap: 0,
          totalLoad: 0,
          carrier: 'Straße (LKW)',
          issues: 0
        };
      }

      pairMap[pair].lines.push(line);
      pairMap[pair].totalCap += line.capacity;
      pairMap[pair].totalLoad += line.load;
      if (line.utilization === 0 || (line.warnings && line.warnings.length > 0)) {
        pairMap[pair].issues++;
      }
    });

    const rows = Object.values(pairMap);

    tbody.innerHTML = rows.map(item => {
      const util = item.totalCap > 0 ? Math.round((item.totalLoad / item.totalCap) * 100) : 0;
      let qualityBadge = '<span class="warning-badge badge-success">Optimal angebunden</span>';

      if (item.issues > 0 && util === 0) {
        qualityBadge = '<span class="warning-badge badge-critical">🚨 Keine Frachtbewegung</span>';
      } else if (item.issues > 0) {
        qualityBadge = '<span class="warning-badge badge-warning">⚠️ Taktstörung</span>';
      } else if (util > 80) {
        qualityBadge = '<span class="warning-badge" style="background: rgba(139, 92, 246, 0.2); color: var(--status-purple);">Hohe Nachfrage</span>';
      }

      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: #ffffff; font-size: 0.95rem;">${item.name}</div>
            <div style="font-size: 0.76rem; color: var(--text-dim); margin-top: 2px;">
              ${item.lines.length} ${item.lines.length === 1 ? 'Route' : 'Routen'} aktiv: ${item.lines.map(l => l.name).join(', ')}
            </div>
          </td>
          <td>
            <span style="display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">
              <span>🚚</span>
              <span>${item.carrier}</span>
            </span>
          </td>
          <td>
            <span style="font-family: var(--font-mono); font-weight: 600; color: #ffffff;">
              ${item.totalCap} Einheiten/Zyklus
            </span>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-family: var(--font-mono); font-weight: 700; min-width: 40px; color: ${util === 0 ? 'var(--status-rose)' : 'var(--accent-cyan)'};">
                ${util}%
              </span>
              <div class="progress-track" style="flex: 1; max-width: 120px; height: 6px;">
                <div class="progress-bar-fill" style="width: ${Math.max(4, util)}%; background: ${util === 0 ? 'var(--status-rose)' : 'var(--accent-cyan)'};"></div>
              </div>
            </div>
          </td>
          <td>
            ${qualityBadge}
          </td>
        </tr>
      `;
    }).join('');
  }
}

window.CityMatrix = CityMatrix;
