// warnings.js - Rhythm Diagnostics and Savegame Warning Engine
class WarningEngine {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.badge = document.getElementById('tabWarningsBadge');
    this.kpiGhost = document.getElementById('kpiGhostCount');
    this.kpiBunching = document.getElementById('kpiBunchingCount');
  }

  update(lines) {
    if (!this.container || !lines) return;

    const warnings = [];
    let ghostCount = 0;
    let bunchingCount = 0;

    lines.forEach(line => {
      // 1. In-game warnings directly from savegame
      if (line.warnings && line.warnings.length > 0) {
        line.warnings.forEach(w => {
          warnings.push({
            ...w,
            lineName: line.name,
            lineId: line.id,
            lineColor: line.color,
            carrier: line.carrier
          });
          if (w.type === 'GHOST_LINE') ghostCount++;
          if (w.type === 'BUNCHING') bunchingCount++;
        });
      } else {
        // Fallback live check
        if (line.utilization === 0 && line.capacity > 0) {
          ghostCount++;
          warnings.push({
            id: `auto_ghost_${line.id}`,
            type: 'GHOST_LINE',
            severity: 'critical',
            title: `Geisterlinie: 0% Frachtladung`,
            message: `Auf "${line.name}" fahren alle LKW ohne Ladung. Hohe Betriebskosten ohne Einnahmen!`,
            recommendation: `Überprüfe die Güterstation und die Lieferkette von ${line.stops.join(' ➔ ')}.`,
            lineName: line.name,
            lineId: line.id,
            lineColor: line.color
          });
        }

        if (line.rhythmStatus === 'BUNCHING' || (line.rhythmScore && line.rhythmScore < 60)) {
          bunchingCount++;
          warnings.push({
            id: `auto_bunch_${line.id}`,
            type: 'BUNCHING',
            severity: 'warning',
            title: `Pulkbildung & Taktstörung`,
            message: `Fahrzeuge auf "${line.name}" fahren direkt hintereinander statt mit gleichmäßigem Zeitabstand.`,
            recommendation: `Aktiviere in den TF3-Linieneinstellungen die Taktregelung oder sende ein Fahrzeug kurz ins Depot.`,
            lineName: line.name,
            lineId: line.id,
            lineColor: line.color
          });
        }
      }
    });

    if (this.badge) this.badge.textContent = warnings.length;
    if (this.kpiGhost) this.kpiGhost.textContent = ghostCount;
    if (this.kpiBunching) this.kpiBunching.textContent = bunchingCount;

    this.render(warnings);
  }

  render(warnings) {
    if (warnings.length === 0) {
      this.container.innerHTML = `
        <div class="warning-card info">
          <div class="warning-icon-box">✅</div>
          <div class="warning-content">
            <div class="warning-title-row">
              <span class="warning-title">Alle Routen laufen im grünen Bereich</span>
              <span class="warning-badge badge-success">Optimaler Takt</span>
            </div>
            <p class="warning-message">
              Keine Geisterlinien oder Pulkbildungen in deinen Straßennetzen registriert.
            </p>
          </div>
        </div>
      `;
      return;
    }

    this.container.innerHTML = warnings.map(w => {
      const isCritical = w.severity === 'critical';
      const isInfo = w.severity === 'info' || w.type === 'INACTIVE';
      const icon = isCritical ? '👻' : (isInfo ? '⚪' : '⚠️');
      const badgeClass = isCritical ? 'badge-critical' : (isInfo ? 'warning-badge' : 'badge-warning');
      const typeLabel = w.type === 'GHOST_LINE' ? '0% Leerfahrt' : (w.type === 'INACTIVE' ? 'Inaktiv' : 'Takt-Störung');

      return `
        <div class="warning-card ${w.severity || 'warning'}">
          <div class="warning-icon-box" style="color: ${isCritical ? 'var(--status-rose)' : (isInfo ? '#94a3b8' : 'var(--status-amber)')}">
            ${icon}
          </div>
          <div class="warning-content">
            <div class="warning-title-row">
              <span class="warning-title">${w.lineName}: ${w.title}</span>
              <span class="warning-badge ${badgeClass}">${typeLabel}</span>
              <button class="btn btn-glass" style="padding: 2px 10px; font-size: 0.75rem; margin-left: auto;" 
                      onclick="window.app.inspectLine('${w.lineId}')">
                Inspektor ➔
              </button>
            </div>
            <div class="warning-message">${w.message}</div>
            ${w.recommendation ? `
              <div class="warning-recommendation">
                💡 <strong>Empfohlene Gegenmaßnahme:</strong> ${w.recommendation}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }
}

window.WarningEngine = WarningEngine;
