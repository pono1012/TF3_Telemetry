/**
 * TF3 QUANTUM TELEMETRY TERMINAL v3.0
 * Tactical Operations Matrix, In-Table Sparkline Graphs, Financial Runway & Insolvency Prediction
 * Bilingual (EN/DE) with English Primary
 */

(function () {
  'use strict';

  // --- Internationalization (Bilingual EN/DE) ---
  const I18N = {
    en: {
      appTitle: "TF3 QUANTUM TELEMETRY",
      appSubtitle: "TACTICAL OPERATIONS & FINANCIAL INTELLIGENCE DIRECT FROM C++ ENGINE",
      appTitle: "TF3 Telemetry",
      appSubtitle: "Fleet & Financial Operations",
      statusLabel: "STATUS:",
      tabDashboard: "Executive Dashboard",
      tabFleet: "All Lines",
      tabFinances: "Finances",
      tabTactical: "Top & Flop Lines",
      tabWall: "Charts",
      tabPatterns: "Vehicle Advisor",
      tabInspector: "Line Details",
      resetBtn: "Reset",
      mobileBtn: "Mobile",

      // Top Macro KPIs
      treasuryTitle: "Bank Balance",
      nettoTitle: "Net Rate / Min",
      revTitle: "Revenue / Min",
      revSub: "Ticket sales & freight delivery revenue",
      costsTitle: "Fleet Costs / Min",
      utilTitle: "Fleet Utilization",
      citiesLabel: "🏙️ Corridor Cities:",

      // Fleet Matrix Toolbar
      searchPlaceholder: "Search routes, cargo, towns, vehicles...",
      filterAll: "All Lines",
      filterSwap: "Vehicle Swaps",
      filterDeficit: "Loss Makers",
      filterMaint: "Old Vehicles",
      filterBacklog: "High Waiting",
      filterGhost: "Low Load (<20%)",
      btnFleetAdvisor: "Vehicle Advisor",
      fleetAdvisorTitle: "Vehicle Modernization & Replacement",
      fleetAdvisorSubtitle: "Vehicle upgrade suggestions with separate Passenger and Cargo categories",
      viewLive: "⚡ Live",
      view5m: "⏱️ 5m Avg",
      viewSession: "🌐 Session",

      // Table Headers
      thStatus: "Status",
      thLine: "Line / Route",
      thCarrier: "Type & Fleet",
      thLoadCap: "Load / Capacity",
      thUtilGraph: "Utilization & Trend",
      thCashflow: "Cashflow / Min",
      thFreq: "Interval",
      thMaint: "Condition & Penalties",
      thBacklog: "Waiting",
      thInspect: "Details",

      // Finances Tab
      treasuryHeading: "Liquid Cash Reserves",
      burnRate: "Net Change / Min",
      creditLoan: "Bank Loan & Interest",
      ytdEarnings: "Fiscal Year Result",
      advisoriesTitle: "Financial Tips",
      journalTitle: "Accounting Journal (4-Year Balance)",
      journalSub: "Accounting items directly from Transport Fever 3"
    },
    de: {
      appTitle: "TF3 Telemetrie",
      appSubtitle: "Linien- & Finanz-Übersicht",
      statusLabel: "STATUS:",
      tabDashboard: "Executive Dashboard",
      tabFleet: "Alle Linien",
      tabFinances: "Finanzen",
      tabTactical: "Top & Flop Linien",
      tabWall: "Diagramme",
      tabPatterns: "Fahrzeug-Berater",
      tabInspector: "Linien-Details",
      resetBtn: "Zurücksetzen",
      mobileBtn: "Tablet / Mobil",

      // Top Macro KPIs
      treasuryTitle: "Kontostand",
      nettoTitle: "Netto-Saldo / Min",
      revTitle: "Einnahmen / Min",
      revSub: "Summe aller verbuchten Fahrgelder & Frachterlöse",
      costsTitle: "Flottenkosten / Min",
      utilTitle: "Flotten-Auslastung",
      citiesLabel: "🏙️ Städte-Korridore:",

      // Fleet Matrix Toolbar
      searchPlaceholder: "Linien, Fracht, Städte oder Fahrzeuge suchen...",
      filterAll: "Alle Linien",
      filterSwap: "Fahrzeugwechsel",
      filterDeficit: "Verlustbringer",
      filterMaint: "Alte Fahrzeuge",
      filterBacklog: "Wartende Staus",
      filterGhost: "Geringe Last (<20%)",
      btnFleetAdvisor: "Fahrzeug-Berater",
      fleetAdvisorTitle: "Fahrzeug-Modernisierung & Tausch-Empfehlungen",
      fleetAdvisorSubtitle: "Fahrzeug-Empfehlungen mit getrennter Passagier- und Güter-Auswahl",
      viewLive: "⚡ Live",
      view5m: "⏱️ 5m Schnitt",
      viewSession: "🌐 Gesamtschnitt",

      // Table Headers
      thStatus: "Status",
      thLine: "Linie / Route",
      thCarrier: "Typ & Fuhrpark",
      thLoadCap: "Ladung / Kapazität",
      thUtilGraph: "Auslastung & Verlauf",
      thCashflow: "Cashflow / Min",
      thFreq: "Takt",
      thMaint: "Zustand & Strafaufschlag",
      thBacklog: "Wartende",
      thInspect: "Details",

      // Finances Tab
      treasuryHeading: "Barvermögen & Kontostand",
      burnRate: "Netto-Veränderung / Min",
      creditLoan: "Kreditstand & Zinsen",
      ytdEarnings: "Jahresergebnis",
      advisoriesTitle: "Finanz-Hinweise",
      journalTitle: "Buchungsjournal (4-Jahres-Bilanz)",
      journalSub: "Buchungsposten direkt aus Transport Fever 3"
    }
  };

  let currentLang = localStorage.getItem('tf3_telemetry_lang') || 'en';

  // --- Global State ---
  let ws = null;
  let latestData = null;
  let activeTab = 'tab-dashboard'; // PRIMARY FIRST VIEW: Executive Summary Dashboard!
  let tableCategory = 'ALL';
  let tableCity = 'ALL';
  let tableRiskFilter = 'ALL'; // ALL, DEFICIT, MAINT, BACKLOG, GHOST
  let tableSortColumn = 'cashflow60s';
  let tableSortAsc = false;
  let selectedRouteId = null;
  let chartHorizon = '1m';
  let selectedAvgWindow = '5m';
  let selectedHorizon = localStorage.getItem('tf3_horizon') || 'all'; // 'all', 'year', 'month', 'week', 'live'
  let selectedUnit = localStorage.getItem('tf3_unit') || 'year'; // 'year', 'month', 'day', 'min'
  let tableDisplayMode = localStorage.getItem('tf3_table_mode') || 'year'; // 'year', 'month', 'day', 'live', 'session'
  let treasuryHorizon = '5m';
  let localTreasuryHistory = []; // Cumulative frontend store for treasury balance points
  let warnTypeFilter = 'ALL'; // ALL, PAX, CARGO
  let warnCityFilter = 'ALL';

  // Chart instances
  let chartWallTop5 = null;
  let chartWallFlop5 = null;
  let chartWallVolume = null;
  let chartWallWaiting = null;
  let chartWallSpeed = null;
  let chartWallMaint = null;
  let chartTreasury = null;
  let chartCockpitBalance = null;
  let chartCockpitLoan = null;
  let chartCockpitUtil = null;
  let chartRouteInspector = null;
  let inspectorMetric = 'util'; // 'util', 'load', 'cashflow', 'waiting', 'speed'
  let inspectorHorizon = '5m'; // '1m', '5m', '15m', '30m', 'all'
  let routeHistoryCache = {};
  let warehouseFilter = 'ALL';
  let warehouseSearchQuery = '';

  // Format Helpers
  function formatMoney(val, showPlus = false) {
    if (val === null || val === undefined || isNaN(val)) return '$0';
    const sign = val < 0 ? '-' : (showPlus && val > 0 ? '+' : '');
    const av = Math.abs(val);
    if (av >= 10000000) return `${sign}$${(av / 1000000).toFixed(1)}M`;
    if (av >= 1000000) return `${sign}$${(av / 1000000).toFixed(2)}M`;
    if (av >= 10000) return `${sign}$${Math.round(av / 1000)}k`;
    if (av >= 1000) return `${sign}$${(av / 1000).toFixed(1)}k`;
    return `${sign}$${Math.round(av)}`;
  }

  function formatFreq(s) {
    if (!s || s <= 0) return '-';
    if (s < 120) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return rem > 0 ? `${m}m${rem < 10 ? '0' : ''}${rem}s` : `${m}m`;
  }

  function formatAge(ageYears) {
    if (!ageYears || ageYears <= 0) return '-';
    if (ageYears < 1.0) {
      const mo = Math.max(1, Math.round(ageYears * 12));
      return currentLang === 'de' ? `${mo} Mo` : `${mo} mo`;
    }
    return currentLang === 'de' ? `${ageYears.toFixed(1)} J` : `${ageYears.toFixed(1)} yr`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function extractCityFromLineName(name) {
    if (!name) return 'Unbekannt';
    const parts = name.split(/\s*-\s*/);
    if (parts.length > 1) return parts[0].trim();
    const colonParts = name.split(':');
    if (colonParts.length > 1) return colonParts[0].trim();
    return name.split(' ')[0] || 'Unbekannt';
  }

  // --- Inline Sparkline SVG Generator ---
  function renderSparklineSvg(points, width = 85, height = 24, customMin = null, customMax = null) {
    if (!points || points.length === 0) {
      return `<svg class="sparkline-svg" viewBox="0 0 ${width} ${height}"><line x1="0" y1="${height / 2}" x2="${width}" y2="${height / 2}" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/></svg>`;
    }
    
    const numeric = points.map(p => typeof p === 'number' ? p : 0);
    const minVal = customMin !== null ? customMin : (numeric.every(p => p >= 0 && p <= 100) ? 0 : Math.min(...numeric));
    const maxVal = customMax !== null ? customMax : (numeric.every(p => p >= 0 && p <= 100) ? 100 : Math.max(...numeric));
    const range = (maxVal - minVal) || 1;
    const stepX = width / Math.max(1, numeric.length - 1);

    const coords = numeric.map((p, i) => {
      const x = Math.round(i * stepX);
      const clamped = Math.max(minVal, Math.min(maxVal, p));
      const y = Math.round(height - ((clamped - minVal) / range) * (height - 6) - 3);
      return `${x},${y}`;
    });

    const lastVal = numeric[numeric.length - 1];
    let color = '#38bdf8';
    if (customMin === null && customMax === null && minVal === 0 && maxVal === 100) {
      color = lastVal >= 65 ? '#10b981' : (lastVal >= 25 ? '#f59e0b' : '#f43f5e');
    } else {
      color = lastVal >= 0 ? '#10b981' : '#f43f5e';
    }
    const polyline = coords.join(' ');
    const areaCoords = `0,${height} ${polyline} ${width},${height}`;

    return `
      <svg class="sparkline-svg" viewBox="0 0 ${width} ${height}">
        <polygon points="${areaCoords}" fill="${color}" fill-opacity="0.18"/>
        <polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${coords[coords.length - 1].split(',')[0]}" cy="${coords[coords.length - 1].split(',')[1]}" r="2.5" fill="${color}"/>
      </svg>
    `;
  }

  // Toast Notification System
  function showToast(message, type = 'info') {
    let container = document.getElementById('dashboardToastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.style.cssText = 'pointer-events: auto; padding: 12px 18px; border-radius: 8px; font-weight: 600; font-size: 0.88rem; box-shadow: 0 10px 25px rgba(0,0,0,0.5); backdrop-filter: blur(10px); transition: all 0.3s ease; transform: translateY(10px); opacity: 0; display: flex; align-items: center; gap: 10px; border: 1px solid rgba(255,255,255,0.15);';
    if (type === 'error') {
      toast.style.background = 'rgba(239, 68, 68, 0.9)';
      toast.style.color = '#fff';
    } else {
      toast.style.background = 'rgba(15, 23, 42, 0.92)';
      toast.style.color = '#38bdf8';
      toast.style.borderColor = 'rgba(56, 189, 248, 0.4)';
    }
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.transform = 'translateY(0)';
      toast.style.opacity = '1';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 350);
    }, 3200);
  }

  // --- WebSocket Connection ---
  function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    ws = new WebSocket(wsUrl);

    ws.onopen = function () {
      updateConnectionStatus(true);
    };

    ws.onmessage = function (event) {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'TELEMETRY_UPDATE' && msg.data) {
          handleTelemetryTick(msg.data, msg.server);
        } else if (msg.type === 'SESSION_RESET') {
          showToast(currentLang === 'de' ? '✅ Session erfolgreich zurückgesetzt!' : '✅ Session statistics reset successfully!');
          if (latestData) {
            renderTopKPIs(latestData);
            renderTableView(latestData);
          }
        }
      } catch (e) {
        console.error('Error parsing WS message:', e);
      }
    };

    ws.onclose = function () {
      updateConnectionStatus(false);
      setTimeout(initWebSocket, 3000);
    };

    ws.onerror = function () {
      updateConnectionStatus(false);
    };
  }

  function updateConnectionStatus(isLive, data) {
    const pill = document.getElementById('gameStatusIndicator');
    const txt = document.getElementById('statusValText');
    const ping = document.getElementById('radarPingDot');
    if (!pill || !txt) return;

    if (!isLive) {
      pill.classList.remove('paused');
      pill.classList.add('offline');
      txt.textContent = currentLang === 'de' ? 'VERBINDUNG GETRENNT' : 'DISCONNECTED';
      txt.style.color = '#f43f5e';
      if (ping) ping.style.background = '#f43f5e';
    } else if (data && data.simState === 'PAUSED') {
      pill.classList.remove('offline');
      pill.classList.add('paused');
      txt.textContent = currentLang === 'de' ? '⏸️ SPIEL PAUSIERT' : '⏸️ SIM PAUSED';
      txt.style.color = '#f59e0b';
      if (ping) ping.style.background = '#f59e0b';
    } else {
      pill.classList.remove('offline', 'paused');
      const speed = data && data.simSpeed && data.simSpeed > 1 ? ` (${data.simSpeed}x)` : ' (1x)';
      txt.textContent = currentLang === 'de' ? `TF3 LIVE${speed}` : `TF3 LIVE${speed}`;
      txt.style.color = '#10b981';
      if (ping) ping.style.background = '#10b981';
    }
  }

  // --- Main Data Dispatcher ---
  function handleTelemetryTick(data, serverMeta) {
    latestData = data;
    updateConnectionStatus(true, data);

    // Header Game Date & Duration
    const headerDate = document.getElementById('headerGameDate');
    if (headerDate) headerDate.textContent = data.gameDate || '--.--.----';

    const headerDuration = document.getElementById('headerPlayDuration');
    if (headerDuration) {
      headerDuration.textContent = data.playDuration || (data.sessionElapsedMinutes ? `${Math.floor(data.sessionElapsedMinutes)}m` : '--');
    }

    renderHealthScore(data);
    renderTopKPIs(data);

    // Tab-specific view renders
    if (activeTab === 'tab-dashboard' || activeTab === 'tab-cockpit') {
      renderCockpitView(data);
    } else if (activeTab === 'tab-table') {
      renderTableView(data);
    } else if (activeTab === 'tab-finances') {
      renderFinancesView(data);
    } else if (activeTab === 'tab-wall-charts') {
      renderWallOfCharts(data);
    } else if (activeTab === 'tab-patterns') {
      renderPatternsAndForecasting(data);
    } else if (activeTab === 'tab-inspector') {
      renderRouteInspector(data);
    }

    updateCityFilterBar(data.lines || []);
    updateRouteDropdowns(data.lines || []);

    if (serverMeta) {
      const modalQr = document.getElementById('modalQrCodeImg');
      if (modalQr && serverMeta.qrCode) modalQr.src = serverMeta.qrCode;
      const modalUrl = document.getElementById('modalTabletUrl');
      if (modalUrl && serverMeta.tabletUrl) modalUrl.textContent = serverMeta.tabletUrl;
    }
  }

  // --- Health Score Calculation ---
  function renderHealthScore(data) {
    const badge = document.getElementById('networkHealthBadge');
    const txt = document.getElementById('networkHealthText');
    if (!badge || !txt) return;

    const lines = data.lines || [];
    if (lines.length === 0) {
      txt.textContent = '100% HEALTH';
      return;
    }

    let penaltyDeduction = lines.reduce((s, l) => s + (l.costPenalty || 0), 0) / lines.length;
    let deficitDeduction = (lines.filter(l => l.cashflow60s < 0).length / lines.length) * 30;
    let jamDeduction = lines.filter(l => l.avgSpeed60s === 0 && l.load > 0).length * 5;

    let score = Math.max(10, Math.min(100, Math.round(100 - penaltyDeduction - deficitDeduction - jamDeduction)));
    txt.textContent = `${score}% HEALTH`;

    if (score >= 80) {
      badge.style.background = 'rgba(16, 185, 129, 0.12)';
      badge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      badge.style.color = 'var(--status-emerald)';
    } else if (score >= 50) {
      badge.style.background = 'rgba(245, 158, 11, 0.12)';
      badge.style.borderColor = 'rgba(245, 158, 11, 0.3)';
      badge.style.color = 'var(--status-amber)';
    } else {
      badge.style.background = 'rgba(244, 63, 94, 0.12)';
      badge.style.borderColor = 'rgba(244, 63, 94, 0.3)';
      badge.style.color = 'var(--status-rose)';
    }
  }

  // --- Top Macro KPIs ---
  function renderTopKPIs(data) {
    const nettoMin = data.nettoPerMin || (data.finances && data.finances.ratePerMin) || (data.totalCashflow60s || 0);
    const revenueMin = data.revenuePerMin || (data.totalRevenue60s || 0);
    const runningCostsMin = data.runningCostsPerMin || (data.totalRunningCosts60s || 0);

    const avg = data.treasuryAverages || (data.finances && data.finances.averages) || {};
    const hData = avg[selectedHorizon] || avg['all'] || null;

    let netVal = 0;
    let netFormatted = '$0';
    let subtext = '';

    if (hData) {
      if (selectedUnit === 'year') {
        netVal = hData.ratePerYear;
        netFormatted = `${formatMoney(netVal, true)} / Jahr`;
      } else if (selectedUnit === 'month') {
        netVal = hData.ratePerMonth;
        netFormatted = `${formatMoney(netVal, true)} / Monat`;
      } else if (selectedUnit === 'day') {
        netVal = hData.ratePerDay;
        netFormatted = `${formatMoney(netVal, true)} / Tag`;
      } else {
        netVal = hData.ratePerMin;
        netFormatted = `${formatMoney(netVal, true)} / Min`;
      }

      if (selectedHorizon === 'all') {
        subtext = currentLang === 'de'
          ? `Ø über ${hData.years || 0} Ingame-Jahre (${hData.startDate || ''} – ${hData.endDate || ''})`
          : `Avg across ${hData.years || 0} in-game years (${hData.startDate || ''} – ${hData.endDate || ''})`;
      } else if (selectedHorizon === 'year') {
        subtext = currentLang === 'de'
          ? `Ø Letztes Ingame-Jahr (${hData.startDate || ''} – ${hData.endDate || ''})`
          : `Avg last in-game year (${hData.startDate || ''} – ${hData.endDate || ''})`;
      } else if (selectedHorizon === 'month') {
        subtext = currentLang === 'de'
          ? `Ø Letzter Ingame-Monat (${hData.startDate || ''} – ${hData.endDate || ''})`
          : `Avg last in-game month (${hData.startDate || ''} – ${hData.endDate || ''})`;
      } else if (selectedHorizon === 'week') {
        subtext = currentLang === 'de'
          ? `Ø Letzte 7 Ingame-Tage (${hData.startDate || ''} – ${hData.endDate || ''})`
          : `Avg last 7 in-game days (${hData.startDate || ''} – ${hData.endDate || ''})`;
      } else {
        subtext = currentLang === 'de' ? 'Live 60-Sekunden Echtzeit' : 'Live 60s real-time';
      }
    } else {
      netVal = data.nettoPerMin || (data.finances && data.finances.ratePerMin) || (data.totalCashflow60s || 0);
      netFormatted = `${formatMoney(netVal, true)} / Min`;
      subtext = currentLang === 'de' ? 'Live 60s' : 'Live 60s';
    }

    const elTitle = document.getElementById('kpiNettoTitle');
    if (elTitle) {
      const horizonLabels = {
        all: currentLang === 'de' ? 'Netto-Saldo (Gesamt Ø)' : 'Net Profit (All-Time Avg)',
        year: currentLang === 'de' ? 'Netto-Saldo (1 Jahr Ø)' : 'Net Profit (1y Avg)',
        month: currentLang === 'de' ? 'Netto-Saldo (1 Monat Ø)' : 'Net Profit (1mo Avg)',
        week: currentLang === 'de' ? 'Netto-Saldo (7 Tage Ø)' : 'Net Profit (7d Avg)',
        live: currentLang === 'de' ? 'Netto-Saldo (Live 60s)' : 'Net Profit (Live 60s)'
      };
      elTitle.textContent = horizonLabels[selectedHorizon] || 'Operativer Netto-Saldo';
    }

    const elNetto = document.getElementById('kpiNettoMin');
    if (elNetto) {
      elNetto.textContent = netFormatted;
      elNetto.style.color = netVal >= 0 ? 'var(--status-emerald)' : 'var(--status-rose)';
    }

    const elSub = document.getElementById('kpiNettoSub');
    if (elSub) {
      elSub.textContent = subtext;
    }

    const elMargin = document.getElementById('kpiProfitMargin');
    if (elMargin) {
      const margin = revenueMin > 0 ? Math.round((nettoMin / revenueMin) * 100) : 0;
      elMargin.textContent = `${margin}% ${currentLang === 'de' ? 'Marge' : 'Margin'}`;
      elMargin.className = `kpi-trend ${margin >= 0 ? 'trend-up' : 'trend-down'}`;
    }

    const elRev = document.getElementById('kpiRevenueMin');
    if (elRev) elRev.textContent = `${formatMoney(revenueMin, false)}/m`;

    const elCosts = document.getElementById('kpiCostsMin');
    if (elCosts) elCosts.textContent = `${formatMoney(runningCostsMin, false)}/m`;

    const elCostsYear = document.getElementById('kpiCostsYear');
    if (elCostsYear) elCostsYear.textContent = `${formatMoney(data.totalRunningCostsPerYear, false)}/${currentLang === 'de' ? 'Jahr' : 'yr'}`;

    // Wasted Penalty
    const elPenalty = document.getElementById('kpiPenaltyWasted');
    if (elPenalty) {
      const lines = data.lines || [];
      const totalWastedYear = lines.reduce((s, l) => s + (l.potentialSavingsYear || 0), 0);
      elPenalty.textContent = totalWastedYear > 0 
        ? (currentLang === 'de' ? `⚠️ ${formatMoney(totalWastedYear)}/J Strafkosten durch Alterung` : `⚠️ ${formatMoney(totalWastedYear)}/yr aging penalty waste`)
        : (currentLang === 'de' ? `✅ Keine Wartungs-Strafen aktiv` : `✅ Zero aging penalties active`);
      elPenalty.style.color = totalWastedYear > 0 ? 'var(--status-amber)' : 'var(--status-emerald)';
    }

    // Bank Balance & Trend
    const fin = data.finances || {};
    const elBank = document.getElementById('kpiBankBalance');
    if (elBank) {
      elBank.textContent = formatMoney(fin.bankBalance || 0, false);
    }

    const elTrend = document.getElementById('kpiBalanceTrend');
    if (elTrend) {
      const rate = fin.ratePerMin || 0;
      if (rate > 1000) {
        elTrend.textContent = `▲ +${formatMoney(rate, false)}/m`;
        elTrend.style.background = 'rgba(16, 185, 129, 0.18)';
        elTrend.style.color = 'var(--status-emerald)';
        elTrend.style.borderColor = 'rgba(16, 185, 129, 0.35)';
      } else if (rate < -1000) {
        elTrend.textContent = `▼ ${formatMoney(rate, false)}/m`;
        elTrend.style.background = 'rgba(244, 63, 94, 0.18)';
        elTrend.style.color = 'var(--status-rose)';
        elTrend.style.borderColor = 'rgba(244, 63, 94, 0.35)';
      } else {
        elTrend.textContent = `▶ ±$0/m`;
        elTrend.style.background = 'rgba(148, 163, 184, 0.15)';
        elTrend.style.color = 'var(--text-muted)';
        elTrend.style.borderColor = 'rgba(148, 163, 184, 0.3)';
      }
    }

    const elBalSub = document.getElementById('kpiBalanceSub');
    if (elBalSub) {
      if (fin.runwayMinutes !== null && fin.runwayMinutes < 60) {
        elBalSub.innerHTML = `<span style="color: var(--status-rose); font-weight: 700;">⚠️ Runway: ~${fin.runwayMinutes} Min</span> • Debt: ${formatMoney(fin.loan || 0)}`;
      } else {
        elBalSub.textContent = `Debt: ${formatMoney(fin.loan || 0)} • YTD: ${formatMoney(fin.earningsYear || 0, true)}`;
      }
    }

    const badgeFin = document.getElementById('badgeFinanceTrend');
    if (badgeFin) {
      const rate = fin.ratePerMin || 0;
      badgeFin.textContent = `${formatMoney(rate, true)}/m`;
      badgeFin.style.color = rate >= 0 ? 'var(--status-emerald)' : 'var(--status-rose)';
      badgeFin.style.background = rate >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)';
    }

    // Utilization
    const elUtil = document.getElementById('kpiUtilization');
    if (elUtil) elUtil.textContent = `${data.overallUtilization || 0}%`;

    const elAvgBadge = document.getElementById('kpiAvgUtilBadge');
    if (elAvgBadge) {
      const netAverages = data.networkAverages || {};
      const win = netAverages[selectedAvgWindow] || { util: data.overallUtilization || 0 };
      elAvgBadge.textContent = `Avg 5m: ${win.util}%`;
    }

    const elWaiting = document.getElementById('kpiWaitingCount');
    if (elWaiting) {
      elWaiting.textContent = currentLang === 'de'
        ? `Wartend: ${(data.totalNetworkWaiting || 0).toLocaleString()} Fracht & PAX an Haltestellen`
        : `Waiting: ${(data.totalNetworkWaiting || 0).toLocaleString()} cargo & pax at terminals`;
    }

    // Top Macro Grid: Live PAX Metrics
    const pax = data.paxSummary || { load: 0, capacity: 0, waiting: 0, lineCount: 0, vehicleCount: 0, util: 0 };
    const elPaxUtil = document.getElementById('kpiPaxUtil');
    if (elPaxUtil) elPaxUtil.textContent = `${pax.util}%`;
    const elPaxLoadCap = document.getElementById('kpiPaxLoadCap');
    if (elPaxLoadCap) elPaxLoadCap.textContent = `${pax.load} / ${pax.capacity} Pax`;
    const elPaxBar = document.getElementById('kpiPaxBar');
    if (elPaxBar) elPaxBar.style.width = `${Math.min(100, pax.util)}%`;
    const elPaxWait = document.getElementById('kpiPaxWaiting');
    if (elPaxWait) elPaxWait.textContent = currentLang === 'de' ? `Wartend: ${pax.waiting} Pax an Terminals` : `Waiting: ${pax.waiting} Pax at stops`;

    // Top Macro Grid: Live Cargo Metrics
    const cargo = data.cargoSummary || { load: 0, capacity: 0, waiting: 0, lineCount: 0, vehicleCount: 0, util: 0 };
    const elCargoUtil = document.getElementById('kpiCargoUtil');
    if (elCargoUtil) elCargoUtil.textContent = `${cargo.util}%`;
    const elCargoLoadCap = document.getElementById('kpiCargoLoadCap');
    if (elCargoLoadCap) elCargoLoadCap.textContent = `${cargo.load} / ${cargo.capacity} Fracht`;
    const elCargoBar = document.getElementById('kpiCargoBar');
    if (elCargoBar) elCargoBar.style.width = `${Math.min(100, cargo.util)}%`;
    const elCargoWait = document.getElementById('kpiCargoWaiting');
    if (elCargoWait) elCargoWait.textContent = currentLang === 'de' ? `Wartend: ${cargo.waiting} Fracht in Lagern` : `Waiting: ${cargo.waiting} Cargo in warehouses`;

    // Top Macro Grid: Loan & Interest
    const elLoan = document.getElementById('kpiLoanVal');
    if (elLoan) elLoan.textContent = formatMoney(fin.loan || 0, false);
    const elInterest = document.getElementById('kpiInterestVal');
    if (elInterest) {
      const interestM = fin.interestPerMonth || Math.round(((fin.loan || 0) * 0.015) / 12);
      elInterest.textContent = `${formatMoney(interestM, false)}/M`;
    }
    const elLoanSub = document.getElementById('kpiLoanSub');
    if (elLoanSub) {
      const annualInt = fin.interest || Math.round((fin.loan || 0) * 0.015);
      elLoanSub.textContent = currentLang === 'de' ? `Zins: 1.5% p.a. (~${formatMoney(annualInt)}/J)` : `Interest: 1.5% p.a. (~${formatMoney(annualInt)}/yr)`;
    }

    const badgeAll = document.getElementById('badgeAllLines');
    if (badgeAll) badgeAll.textContent = data.totalLines || (data.lines || []).length;
  }

  // ==========================================================================
  // TAB 1: FLEET OPERATIONS MATRIX (PRIMARY FIRST VIEW WITH IN-TABLE GRAPHS)
  // ==========================================================================
  function renderTableView(data) {
    // Render Top PAX & Cargo Split KPI Header
    const pax = data.paxSummary || { load: 0, capacity: 0, waiting: 0, lineCount: 0, vehicleCount: 0, util: 0 };
    const cargo = data.cargoSummary || { load: 0, capacity: 0, waiting: 0, lineCount: 0, vehicleCount: 0, util: 0 };

    const elPaxFleet = document.getElementById('paxFleetSub');
    if (elPaxFleet) elPaxFleet.textContent = `${pax.lineCount} Linien • ${pax.vehicleCount} Fahrzeuge`;
    const elPaxUtil = document.getElementById('paxUtilVal');
    if (elPaxUtil) elPaxUtil.textContent = `${pax.util}%`;
    const elPaxBar = document.getElementById('paxUtilBar');
    if (elPaxBar) elPaxBar.style.width = `${Math.min(100, pax.util)}%`;
    const elPaxLoad = document.getElementById('paxLoadCap');
    if (elPaxLoad) elPaxLoad.textContent = `${pax.load} / ${pax.capacity} Pax`;
    const elPaxWait = document.getElementById('paxWaitingVal');
    if (elPaxWait) elPaxWait.textContent = `${pax.waiting} Pax`;

    const elCargoFleet = document.getElementById('cargoFleetSub');
    if (elCargoFleet) elCargoFleet.textContent = `${cargo.lineCount} Linien • ${cargo.vehicleCount} Fahrzeuge`;
    const elCargoUtil = document.getElementById('cargoUtilVal');
    if (elCargoUtil) elCargoUtil.textContent = `${cargo.util}%`;
    const elCargoBar = document.getElementById('cargoUtilBar');
    if (elCargoBar) elCargoBar.style.width = `${Math.min(100, cargo.util)}%`;
    const elCargoLoad = document.getElementById('cargoLoadCap');
    if (elCargoLoad) elCargoLoad.textContent = `${cargo.load} / ${cargo.capacity} Fracht`;
    const elCargoWait = document.getElementById('cargoWaitingVal');
    if (elCargoWait) elCargoWait.textContent = `${cargo.waiting} Fracht`;

    const totalWaiting = (pax.waiting || 0) + (cargo.waiting || 0);
    const elTotWait = document.getElementById('totalWaitingVal');
    if (elTotWait) elTotWait.textContent = `${totalWaiting.toLocaleString()}`;
    const elPaxSplit = document.getElementById('paxWaitSplit');
    if (elPaxSplit) elPaxSplit.textContent = `👥 ${pax.waiting || 0} Pax`;
    const elCargoSplit = document.getElementById('cargoWaitSplit');
    if (elCargoSplit) elCargoSplit.textContent = `📦 ${cargo.waiting || 0} Fracht`;

    const tbody = document.getElementById('telemetryTableBody');
    if (!tbody) return;

    let lines = [...(data.lines || [])];

    // Update Swap Count Badge
    const swapCount = (data.lines || []).filter(l => l.vehicleAdvice && (l.vehicleAdvice.action === 'SWAP' || l.vehicleAdvice.action === 'UPGRADE')).length;
    const badgeSwap = document.getElementById('badgeSwapCount');
    if (badgeSwap) badgeSwap.textContent = swapCount;

    // 1. Filter Category (Road Cargo, Pax, Rail, Water, Air)
    if (tableCategory !== 'ALL') {
      lines = lines.filter(l => l.carrier === tableCategory || l.carrierCategory === tableCategory);
    }

    // 2. Filter City Corridor
    if (tableCity !== 'ALL') {
      lines = lines.filter(l => {
        if (l.towns && Array.isArray(l.towns)) {
          return l.towns.includes(tableCity);
        }
        return extractCityFromLineName(l.name) === tableCity;
      });
    }

    // 3. Filter Risk Category (User Request!)
    if (tableRiskFilter === 'SWAP') {
      lines = lines.filter(l => l.vehicleAdvice && (l.vehicleAdvice.action === 'SWAP' || l.vehicleAdvice.action === 'UPGRADE'));
    } else if (tableRiskFilter === 'DEFICIT') {
      lines = lines.filter(l => (l.cashflow60s || 0) < 0);
    } else if (tableRiskFilter === 'MAINT') {
      lines = lines.filter(l => (l.costPenalty || 0) >= 10);
    } else if (tableRiskFilter === 'BACKLOG') {
      lines = lines.filter(l => (l.totalWaiting || 0) >= 40);
    } else if (tableRiskFilter === 'GHOST') {
      lines = lines.filter(l => (l.vehicleCount || 0) >= 2 && (l.avgUtil60s || l.utilization || 0) < 20);
    }

    // 4. Search Filter
    const searchInput = document.getElementById('tableSearchInput');
    const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
    if (query) {
      lines = lines.filter(l => {
        const n = (l.name || '').toLowerCase();
        const c = (l.cargoType || '').toLowerCase();
        const t = (l.towns || []).join(' ').toLowerCase();
        return n.includes(query) || c.includes(query) || t.includes(query);
      });
    }

    // 5. Sorting
    lines.sort((a, b) => {
      let valA, valB;
      if (tableSortColumn === 'vehicleCount' || tableSortColumn === 'carrier') {
        valA = a.vehicleCount || (a.vehicles ? a.vehicles.length : 0);
        valB = b.vehicleCount || (b.vehicles ? b.vehicles.length : 0);
      } else if (tableSortColumn === 'load') {
        valA = (tableDisplayMode === 'live' ? (a.liveLoad !== undefined ? a.liveLoad : a.load) : (tableDisplayMode === 'session' ? a.sessionAvgLoad : a.avgLoad60s)) || 0;
        valB = (tableDisplayMode === 'live' ? (b.liveLoad !== undefined ? b.liveLoad : b.load) : (tableDisplayMode === 'session' ? b.sessionAvgLoad : b.avgLoad60s)) || 0;
      } else if (tableSortColumn === 'avgUtil60s') {
        valA = (tableDisplayMode === 'live' ? (a.liveUtil !== undefined ? a.liveUtil : a.utilization) : a.avgUtil60s) || 0;
        valB = (tableDisplayMode === 'live' ? (b.liveUtil !== undefined ? b.liveUtil : b.utilization) : b.avgUtil60s) || 0;
      } else if (tableSortColumn === 'cashflow60s') {
        const getCash = (x) => {
          if (tableDisplayMode === 'year') return x.lineAvgPerYear !== undefined ? x.lineAvgPerYear : (x.cashflow60s || 0);
          if (tableDisplayMode === 'month') return x.lineAvgPerMonth !== undefined ? x.lineAvgPerMonth : (x.cashflow60s || 0);
          if (tableDisplayMode === 'day') return x.lineAvgPerDay !== undefined ? x.lineAvgPerDay : (x.cashflow60s || 0);
          if (tableDisplayMode === 'live') return x.liveCashflow !== undefined ? x.liveCashflow : (x.cashflow || 0);
          if (tableDisplayMode === 'session') return x.sessionTotalCashflow !== undefined ? x.sessionTotalCashflow : (x.sessionEarningsPerMin || 0);
          return x.cashflow60s || 0;
        };
        valA = getCash(a);
        valB = getCash(b);
      } else {
        valA = a[tableSortColumn];
        valB = b[tableSortColumn];
      }
      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toLowerCase();
        return tableSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      valA = valA || 0;
      valB = valB || 0;
      return tableSortAsc ? valA - valB : valB - valA;
    });

    if (lines.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 40px; color: var(--text-dim);">${currentLang === 'de' ? 'Keine Linien mit aktuellen Filtern gefunden.' : 'No routes found matching active filters.'}</td></tr>`;
      return;
    }

    tbody.innerHTML = lines.map(l => {
      let curLoad, curUtil, curCash, cashSubtext, cashUnit;
      if (tableDisplayMode === 'year') {
        curLoad = (l.avg5m && typeof l.avg5m.load === 'number') ? Math.round(l.avg5m.load * 10) / 10 : (l.avgLoad60s || l.load || 0);
        curUtil = (l.avg5m && typeof l.avg5m.util === 'number') ? l.avg5m.util : (l.avgUtil60s || l.utilization || 0);
        curCash = l.lineAvgPerYear !== undefined ? l.lineAvgPerYear : (l.cashflow60s * 525600 / 60);
        cashSubtext = currentLang === 'de' ? 'Ø Ingame-Jahr' : 'Avg in-game year';
        cashUnit = '/J';
      } else if (tableDisplayMode === 'month') {
        curLoad = (l.avg5m && typeof l.avg5m.load === 'number') ? Math.round(l.avg5m.load * 10) / 10 : (l.avgLoad60s || l.load || 0);
        curUtil = (l.avg5m && typeof l.avg5m.util === 'number') ? l.avg5m.util : (l.avgUtil60s || l.utilization || 0);
        curCash = l.lineAvgPerMonth !== undefined ? l.lineAvgPerMonth : (l.cashflow60s * 43800 / 60);
        cashSubtext = currentLang === 'de' ? 'Ø Ingame-Monat' : 'Avg in-game month';
        cashUnit = '/M';
      } else if (tableDisplayMode === 'day') {
        curLoad = (l.avg5m && typeof l.avg5m.load === 'number') ? Math.round(l.avg5m.load * 10) / 10 : (l.avgLoad60s || l.load || 0);
        curUtil = (l.avg5m && typeof l.avg5m.util === 'number') ? l.avg5m.util : (l.avgUtil60s || l.utilization || 0);
        curCash = l.lineAvgPerDay !== undefined ? l.lineAvgPerDay : (l.cashflow60s * 1440 / 60);
        cashSubtext = currentLang === 'de' ? 'Ø Ingame-Tag' : 'Avg in-game day';
        cashUnit = '/T';
      } else if (tableDisplayMode === 'live') {
        curLoad = l.liveLoad !== undefined ? l.liveLoad : (l.load || 0);
        curUtil = l.liveUtil !== undefined ? l.liveUtil : (l.utilization || 0);
        curCash = l.liveCashflow !== undefined ? l.liveCashflow : (l.cashflow || 0);
        cashSubtext = currentLang === 'de' ? 'Live-Tick' : 'Live tick';
        cashUnit = '';
      } else {
        // session
        curLoad = l.sessionAvgLoad !== undefined ? Math.round(l.sessionAvgLoad * 10) / 10 : (l.load || 0);
        curUtil = (l.avgSession && typeof l.avgSession.util === 'number') ? l.avgSession.util : (l.avgUtil60s || l.utilization || 0);
        curCash = l.sessionTotalCashflow !== undefined ? l.sessionTotalCashflow : (l.sessionEarningsPerMin !== undefined ? l.sessionEarningsPerMin : (l.cashflow60s || 0));
        cashSubtext = currentLang === 'de' ? 'Gesamt Session' : 'Total session';
        cashUnit = ' Σ';
      }
      const curCap = l.capacity || 0;

      // Carrier Tag styling
      let carrierTagClass = 'tag-cargo';
      let carrierTagText = '🚚 CARGO';
      if (l.carrier === 'ROAD_PERSON' || l.isOpnv) {
        carrierTagClass = 'tag-pax';
        carrierTagText = '🚌 TRANSIT';
      } else if (l.carrier === 'RAIL') {
        carrierTagClass = 'tag-rail';
        carrierTagText = '🚆 RAIL';
      } else if (l.carrier === 'WATER') {
        carrierTagClass = 'tag-water';
        carrierTagText = '🚢 WATER';
      } else if (l.carrier === 'AIR') {
        carrierTagClass = 'tag-air';
        carrierTagText = '✈️ AIR';
      }

      // Load Bar Color
      const barClass = curUtil >= 70 ? 'fill-green' : (curUtil >= 30 ? 'fill-amber' : 'fill-rose');

      // Sparkline points (compact 64x20)
      const sparkPoints = (l.sparklineUtil && l.sparklineUtil.length > 0) ? l.sparklineUtil : [curUtil, curUtil];
      const sparkSvg = renderSparklineSvg(sparkPoints, 64, 20);

      // Status Pill
      let statusDotClass = 'var(--status-emerald)';
      let statusText = 'ACTIVE';
      if (curCash < -3000) {
        statusDotClass = 'var(--status-rose)';
        statusText = 'DEFICIT';
      } else if ((l.costPenalty || 0) >= 15) {
        statusDotClass = 'var(--status-amber)';
        statusText = 'MAINT';
      } else if ((l.totalWaiting || 0) > 80) {
        statusDotClass = 'var(--accent-cyan)';
        statusText = 'BACKLOG';
      }

      // Towns corridor badge
      const townsStr = (l.towns && l.towns.length > 0) ? l.towns.join(' ➔ ') : '';

      // Vehicle Advice Badge
      const va = l.vehicleAdvice;
      let vaBadgeHtml = '';
      if (va && va.action === 'SWAP') {
        vaBadgeHtml = `
          <div class="va-chip va-swap" title="${escapeHtml(currentLang === 'de' ? va.reason : va.reasonEn)}" onclick="event.stopPropagation(); window.dashboard.openVehicleAdviceModal(${l.id})">
            <span>🔄</span>
            <span>${escapeHtml(va.currentShort)} ➔ <span class="va-target">${escapeHtml(va.targetShort)}</span></span>
          </div>`;
      } else if (va && va.action === 'UPGRADE') {
        vaBadgeHtml = `
          <div class="va-chip va-upgrade" title="${escapeHtml(currentLang === 'de' ? va.reason : va.reasonEn)}" onclick="event.stopPropagation(); window.dashboard.openVehicleAdviceModal(${l.id})">
            <span>⬆️</span>
            <span>${escapeHtml(va.currentShort)} ➔ <span class="va-target">${escapeHtml(va.targetShort)}</span></span>
          </div>`;
      } else if (va && va.action === 'ADD') {
        vaBadgeHtml = `
          <div class="va-chip va-add" title="${escapeHtml(currentLang === 'de' ? va.reason : va.reasonEn)}" onclick="event.stopPropagation(); window.dashboard.openVehicleAdviceModal(${l.id})">
            <span>➕</span>
            <span>+1 ${escapeHtml(va.targetShort)}</span>
          </div>`;
      } else if (va && va.action === 'REMOVE') {
        vaBadgeHtml = `
          <div class="va-chip va-remove" title="${escapeHtml(currentLang === 'de' ? va.reason : va.reasonEn)}" onclick="event.stopPropagation(); window.dashboard.openVehicleAdviceModal(${l.id})">
            <span>➖</span>
            <span>${currentLang === 'de' ? '-1 Fzg abziehen' : '-1 Unit'}</span>
          </div>`;
      }

      return `
        <tr class="tech-line-row" onclick="window.dashboard.openRouteDetails(${l.id})">
          <!-- 1. Status -->
          <td style="padding: 7px 8px;">
            <div style="display: flex; align-items: center; gap: 5px;">
              <span style="width: 7px; height: 7px; border-radius: 50%; background: ${statusDotClass}; box-shadow: 0 0 6px ${statusDotClass};"></span>
              <span style="font-family: var(--font-mono); font-size: 0.7rem; font-weight: 700; color: #fff;">${statusText}</span>
            </div>
          </td>

          <!-- 2. Route Corridor & Cargo -->
          <td style="padding: 7px 8px; max-width: 240px;">
            <div style="font-weight: 700; color: #fff; font-size: 0.88rem; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${escapeHtml(l.name)}
            </div>
            <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
              ${townsStr ? `<span style="font-size: 0.7rem; color: var(--text-muted); font-family: var(--font-mono);">📍 ${escapeHtml(townsStr)}</span>` : ''}
              ${l.cargoType ? `<span style="background: rgba(255,255,255,0.06); padding: 1px 5px; border-radius: 3px; font-size: 0.68rem; color: var(--accent-cyan); font-family: var(--font-mono);">${escapeHtml(l.cargoType)}</span>` : ''}
            </div>
          </td>

          <!-- 3. Carrier & Fleet -->
          <td style="padding: 7px 8px;">
            <div style="margin-bottom: 2px;">
              <span class="carrier-tag ${carrierTagClass}">${carrierTagText}</span>
            </div>
            <div style="font-size: 0.74rem; color: var(--text-muted); font-family: var(--font-mono);">
              <strong style="color: #e2e8f0;">${l.vehicleCount || 0}</strong> ${currentLang === 'de' ? 'Fzg' : 'units'} • Ø ${formatAge(l.avgAgeYears)}
            </div>
            ${vaBadgeHtml}
          </td>

          <!-- 4. Load / Capacity Dual-Tone Cyber Bar -->
          <td style="padding: 7px 8px;">
            <div class="load-bar-box">
              <div class="load-bar-track">
                <div class="load-bar-fill ${barClass}" style="width: ${Math.min(100, curUtil)}%;"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 0.74rem; color: var(--text-muted);">
                <strong style="color: #fff;">${curLoad}</strong>
                <span>/ ${curCap}</span>
              </div>
            </div>
          </td>

          <!-- 5. IN-TABLE UTILIZATION TIME GRAPH -->
          <td style="padding: 7px 8px;">
            <div class="sparkline-wrapper" style="gap: 6px;">
              ${sparkSvg}
              <span class="sparkline-val" style="font-size: 0.78rem; color: ${curUtil >= 65 ? 'var(--status-emerald)' : (curUtil >= 25 ? 'var(--status-amber)' : 'var(--status-rose)')};">
                ${curUtil}%
              </span>
            </div>
          </td>

          <!-- 6. Waiting (Pax / Cargo) -->
          <td style="padding: 7px 8px; font-family: var(--font-mono); font-size: 0.8rem;">
            ${(() => {
              const wait = l.totalWaiting || 0;
              const isPax = !!l.isOpnv || l.carrierCategory === 'ROAD_PERSON';
              const unit = isPax ? 'Pax' : (currentLang === 'de' ? 'Fracht' : 'Cargo');
              const icon = isPax ? '👥' : '📦';
              if (wait > 50) {
                return `<span style="color: var(--status-amber); font-weight: 700;">⚠️ ${wait} ${unit}</span>`;
              } else if (wait > 0) {
                return `<span style="color: #cbd5e1; font-weight: 600;">${icon} ${wait} ${unit}</span>`;
              } else {
                return `<span style="color: var(--text-dim); font-size: 0.74rem;">0 ${unit}</span>`;
              }
            })()}
          </td>

          <!-- 7. Cashflow -->
          <td style="padding: 7px 8px; text-align: right;">
            <div style="font-family: var(--font-mono); font-weight: 700; font-size: 0.86rem; color: ${curCash >= 0 ? 'var(--status-emerald)' : 'var(--status-rose)'};">
              ${formatMoney(curCash, true)}${cashUnit}
            </div>
            <div style="font-size: 0.68rem; color: var(--text-dim); font-family: var(--font-mono);">
              ${cashSubtext}
            </div>
          </td>

          <!-- 8. Headway -->
          <td style="padding: 7px 8px; font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">
            ${formatFreq(l.frequency)}
          </td>

          <!-- 9. Fleet Condition & Penalties -->
          <td style="padding: 7px 8px;">
            <div style="display: flex; align-items: center; gap: 5px;">
              <span style="font-family: var(--font-mono); font-weight: 700; font-size: 0.78rem; color: ${(l.maintState || 100) >= 70 ? 'var(--status-emerald)' : 'var(--status-amber)'};">
                ${l.maintState || 100}%
              </span>
              ${(l.costPenalty || 0) > 0 ? `
                <span style="background: rgba(244,63,94,0.18); border: 1px solid rgba(244,63,94,0.3); color: var(--status-rose); font-size: 0.68rem; padding: 1px 4px; border-radius: 3px; font-family: var(--font-mono);">
                  +${l.costPenalty}% (${formatMoney(l.potentialSavingsYear)}/J)
                </span>
              ` : `
                <span style="color: var(--text-dim); font-size: 0.7rem;">✓ OK</span>
              `}
            </div>
          </td>

          <!-- 10. Action Button -->
          <td style="padding: 7px 8px; text-align: center;">
            <button class="btn btn-glass" style="padding: 3px 6px; font-size: 0.72rem;" onclick="event.stopPropagation(); window.dashboard.openRouteDetails(${l.id})">
              <span>➔</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ==========================================================================
  // TAB 2: TREASURY, RUNWAY & IN-GAME ACCOUNTING JOURNAL
  // ==========================================================================
  const INGAME_FINANCE_ARCHIVE = {
    1980: {
      roadTotal: 5726565,
      runningCosts: -17578111,
      maintenance: -2373054,
      upkeepRoads: -1370624,
      upkeepBuildings: -12925303,
      revenue: 39973657,
      warehouses: -4619775,
      invRoads: -1770068,
      invInfra: -2050597,
      invWarehouses: 0,
      invVehicles: 0
    },
    1981: {
      roadTotal: 5963459,
      runningCosts: -17072834,
      maintenance: -2282389,
      upkeepRoads: -1354212,
      upkeepBuildings: -12627870,
      revenue: 39300764,
      warehouses: -4463726,
      invRoads: -35058,
      invInfra: -6712598,
      invWarehouses: -1897783,
      invVehicles: -2821179
    },
    1982: {
      roadTotal: 4052644,
      runningCosts: -17906353,
      maintenance: -2376218,
      upkeepRoads: -1442019,
      upkeepBuildings: -13301883,
      revenue: 39079117,
      warehouses: -4825075,
      invRoads: -321901,
      invInfra: -1462277,
      invWarehouses: 0,
      invVehicles: -2997205
    },
    1983: {
      roadTotal: 6174156,
      runningCosts: -17260878,
      maintenance: -2630136,
      upkeepRoads: -1428053,
      upkeepBuildings: -13241400,
      revenue: 40734623,
      warehouses: -4825075,
      invRoads: 0,
      invInfra: 0,
      invWarehouses: 0,
      invVehicles: 0
    },
    1984: {
      roadTotal: 5688398,
      runningCosts: -13931890,
      maintenance: -2294903,
      upkeepRoads: -1156834,
      upkeepBuildings: -10768782,
      revenue: 33840807,
      warehouses: -4500000,
      invRoads: 0,
      invInfra: 0,
      invWarehouses: 0,
      invVehicles: 0
    }
  };

  function renderFinancesView(data) {
    const fin = data.finances || {};

    // 1. Runway / Insolvency Banner
    const banner = document.getElementById('runwayAlertBanner');
    const title = document.getElementById('runwayBannerTitle');
    const sub = document.getElementById('runwayBannerSub');
    const pill = document.getElementById('runwayCountdownPill');

    const rate = fin.ratePerMin || 0;
    const balance = fin.bankBalance || 0;

    if (banner && rate < -1000 && balance > 0) {
      banner.style.display = 'flex';
      const runwayMin = Math.round(balance / Math.abs(rate));
      if (title) {
        title.textContent = currentLang === 'de' ? 'KRITISCHER KAPITALVERLUST ERKANNT' : 'CRITICAL CASH BURN DETECTED';
      }
      if (sub) {
        sub.textContent = currentLang === 'de'
          ? `Bei aktuellem Verlust von ${formatMoney(rate)}/min (${formatMoney(rate * 60)}/h) ist das Barvermögen in ca. ${runwayMin} Minuten ($0) aufgebraucht!`
          : `At current burn rate of ${formatMoney(rate)}/min (${formatMoney(rate * 60)}/hr), enterprise cash will be depleted in approx. ${runwayMin} minutes!`;
      }
      if (pill) {
        pill.textContent = `~${runwayMin} MIN RUNWAY`;
      }
    } else if (banner) {
      banner.style.display = 'none';
    }

    // 2. Macro Cards
    const elBank = document.getElementById('finBankBalanceVal');
    if (elBank) elBank.textContent = formatMoney(balance, false);

    const elTrend = document.getElementById('finTrendPill');
    if (elTrend) {
      if (rate > 1000) {
        elTrend.textContent = currentLang === 'de' ? `🟢 Steigend (+${formatMoney(rate)}/m)` : `🟢 Accumulating (+${formatMoney(rate)}/m)`;
        elTrend.style.color = 'var(--status-emerald)';
      } else if (rate < -1000) {
        elTrend.textContent = currentLang === 'de' ? `🔴 Schrumpfend (${formatMoney(rate)}/m)` : `🔴 Depleting (${formatMoney(rate)}/m)`;
        elTrend.style.color = 'var(--status-rose)';
      } else {
        elTrend.textContent = currentLang === 'de' ? '⚪ Ausgeglichen' : '⚪ Balanced';
        elTrend.style.color = 'var(--text-muted)';
      }
    }

    const elRateMin = document.getElementById('finRatePerMinVal');
    if (elRateMin) {
      elRateMin.textContent = `${formatMoney(rate, true)}/m`;
      elRateMin.style.color = rate >= 0 ? 'var(--status-emerald)' : 'var(--status-rose)';
    }

    const elRateHr = document.getElementById('finRatePerHourVal');
    if (elRateHr) {
      elRateHr.textContent = `Projected: ${formatMoney(rate * 60, true)}/h`;
    }

    const elLoan = document.getElementById('finLoanVal');
    if (elLoan) elLoan.textContent = formatMoney(fin.loan || 0, false);

    const elEarnYear = document.getElementById('finEarningsYearVal');
    if (elEarnYear) {
      const ey = fin.earningsYear || 0;
      elEarnYear.textContent = `${formatMoney(ey, true)}`;
      elEarnYear.style.color = ey >= 0 ? 'var(--status-emerald)' : 'var(--status-rose)';
    }

    // 3. AI Financial Advisory Cards ("Was muss man ändern?")
    const advContainer = document.getElementById('financialAdvisoryContainer');
    if (advContainer) {
      const topLosers = (data.topLosers || []).slice(0, 3);
      const totalDeficit = topLosers.reduce((s, l) => s + Math.abs(l.cashflow60s || 0), 0);

      const advisories = [];
      if (topLosers.length > 0) {
        advisories.push({
          severity: 'danger',
          icon: '📉',
          title: currentLang === 'de' ? `${topLosers.length} Hauptverlustbringer identifiziert` : `${topLosers.length} Major Bleeder Routes Identified`,
          description: currentLang === 'de'
            ? `Diese Linien (${topLosers.map(l => l.name).join(', ')}) verbrennen zusammen ca. ${formatMoney(totalDeficit)}/m. Stilllegen oder Fahrzeuge abziehen!`
            : `These routes (${topLosers.map(l => l.name).join(', ')}) burn approx. ${formatMoney(totalDeficit)}/min. Halt or downscale fleet!`,
          action: currentLang === 'de' ? 'Verlustbringer filtern' : 'Filter Bleeders',
          actionType: 'DEFICIT_LINES'
        });
      }

      const maintPenaltyTotal = (data.lines || []).reduce((s, l) => s + (l.potentialSavingsYear || 0), 0);
      if (maintPenaltyTotal > 0) {
        advisories.push({
          severity: 'warn',
          icon: '🔧',
          title: currentLang === 'de' ? 'Alterungs-Strafkosten minimieren' : 'Eliminate Aging Maintenance Penalties',
          description: currentLang === 'de'
            ? `Überalterte Fahrzeuge verursachen jährlich ca. ${formatMoney(maintPenaltyTotal)} an 10%-20% Strafaufschlägen. Fahrzeugerneuerung rechnet sich sofort!`
            : `Overaged vehicles trigger approx. ${formatMoney(maintPenaltyTotal)}/yr in operating surcharges (+10-20%). Fleet replacement pays off immediately!`,
          action: currentLang === 'de' ? 'Betroffene Linien anzeigen' : 'View Affected Lines',
          actionType: 'FLEET_MAINTENANCE'
        });
      }

      advContainer.innerHTML = advisories.map(adv => `
        <div class="panel-box" style="border-left: 3px solid ${adv.severity === 'danger' ? 'var(--status-rose)' : 'var(--status-amber)'}; background: rgba(15, 23, 42, 0.7); padding: 14px 16px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <span style="font-size: 1.25rem;">${adv.icon}</span>
            <strong style="color: #fff; font-size: 0.92rem;">${escapeHtml(adv.title)}</strong>
          </div>
          <div style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.45; margin-bottom: 10px;">
            ${escapeHtml(adv.description)}
          </div>
          <button class="btn btn-glass" style="font-size: 0.75rem; padding: 4px 10px;" onclick="window.dashboard.handleAdvisoryAction('${adv.actionType}')">
            <span>➔</span> <span>${escapeHtml(adv.action)}</span>
          </button>
        </div>
      `).join('');
    }

    // Accumulate into local history cache
    if (Array.isArray(fin.history) && fin.history.length > 0) {
      fin.history.forEach(pt => {
        if (pt && typeof pt.time === 'number' && typeof pt.balance === 'number') {
          if (!localTreasuryHistory.some(p => p.time === pt.time)) {
            localTreasuryHistory.push(pt);
          }
        }
      });
      localTreasuryHistory.sort((a, b) => a.time - b.time);
      if (localTreasuryHistory.length > 3600) {
        localTreasuryHistory = localTreasuryHistory.slice(-3600);
      }
    }

    // 4. Ingame Horizon Matrix
    renderFinanceHorizons(data);

    // 5. In-Game Journal Table
    renderFinanceJournalTable(fin, data);

    // 6. Treasury Chart with Proportional Scaling
    renderTreasuryChart();
  }

  function renderFinanceHorizons(data) {
    const grid = document.getElementById('financeHorizonGrid');
    if (!grid) return;
    const avg = data.treasuryAverages || (data.finances && data.finances.averages) || {};

    const configs = [
      {
        key: 'all',
        icon: '🌐',
        title: currentLang === 'de' ? 'Gesamt-Aufzeichnung' : 'All-Time Recording',
        sub: (h) => currentLang === 'de' ? `${h.days || 0} Ingame-Tage (${h.years || 0} J)` : `${h.days || 0} in-game days (${h.years || 0} y)`
      },
      {
        key: 'year',
        icon: '🗓️',
        title: currentLang === 'de' ? '1 Ingame-Jahr (Ø)' : '1 In-game Year (Avg)',
        sub: (h) => currentLang === 'de' ? `Letzte ${h.days || 365} Ingame-Tage` : `Last ${h.days || 365} in-game days`
      },
      {
        key: 'month',
        icon: '📅',
        title: currentLang === 'de' ? '1 Ingame-Monat (Ø)' : '1 In-game Month (Avg)',
        sub: (h) => currentLang === 'de' ? `Letzte ${h.days || 30} Ingame-Tage` : `Last ${h.days || 30} in-game days`
      },
      {
        key: 'week',
        icon: '📆',
        title: currentLang === 'de' ? '7 Ingame-Tage (Ø)' : '7 In-game Days (Avg)',
        sub: (h) => currentLang === 'de' ? `Letzte 7 Ingame-Tage` : `Last 7 in-game days`
      },
      {
        key: 'live',
        icon: '⚡',
        title: currentLang === 'de' ? 'Live 60-Sekunden' : 'Live 60-Seconds',
        sub: (h) => currentLang === 'de' ? 'Live-Kurzzeit' : 'Live short slice'
      }
    ];

    grid.innerHTML = configs.map(cfg => {
      const h = avg[cfg.key] || { ratePerYear: 0, ratePerMonth: 0, ratePerDay: 0, ratePerMin: 0, delta: 0, days: 0 };
      const isActive = selectedHorizon === cfg.key;
      const rateVal = selectedUnit === 'year' ? h.ratePerYear : (selectedUnit === 'month' ? h.ratePerMonth : (selectedUnit === 'day' ? h.ratePerDay : h.ratePerMin));
      const rateUnitText = selectedUnit === 'year' ? '/Jahr' : (selectedUnit === 'month' ? '/Monat' : (selectedUnit === 'day' ? '/Tag' : '/Min'));
      const isPos = (rateVal || 0) >= 0;

      return `
        <div class="horizon-card ${isActive ? 'active' : ''}" onclick="window.dashboard.setGlobalHorizon('${cfg.key}')">
          <div class="horizon-header">
            <span>${cfg.icon} ${cfg.title}</span>
            ${isActive ? `<span style="font-size: 0.72rem; color: #38bdf8; font-weight: 700;">● AKTIV</span>` : ''}
          </div>
          <div class="horizon-rate" style="color: ${isPos ? 'var(--status-emerald)' : 'var(--status-rose)'};">
            ${formatMoney(rateVal, true)} <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">${rateUnitText}</span>
          </div>
          <div class="horizon-meta">
            <span>📅 ${h.startDate || '-'} ➔ ${h.endDate || '-'} (${cfg.sub(h)})</span>
            <span style="color: ${h.delta >= 0 ? '#6ee7b7' : '#fca5a5'};">Netto-Delta: ${formatMoney(h.delta, true)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderFinanceJournalTable(fin, data) {
    const tbody = document.getElementById('financeJournalTableBody');
    const theadRow = document.getElementById('financeJournalHeaderRow');
    if (!tbody || !theadRow) return;

    let years = (fin && fin.tableYears && fin.tableYears.length > 0) ? fin.tableYears : [];
    if (years.length === 0) {
      let curYear = 1984;
      if (data.gameDate) {
        const m = data.gameDate.match(/\b(19\d\d|20\d\d)\b/);
        if (m) curYear = parseInt(m[1], 10);
      }
      years = [(curYear - 3).toString(), (curYear - 2).toString(), (curYear - 1).toString(), curYear.toString()];
    }

    theadRow.innerHTML = `
      <th style="min-width: 280px; text-align: left; padding: 12px 16px;">${currentLang === 'de' ? 'Kategorie / Buchungsposten' : 'Category / Accounting Item'}</th>
      ${years.map(y => `<th style="text-align: right; min-width: 140px; padding: 12px 16px; font-family: var(--font-mono); font-size: 0.9rem;">${y}</th>`).join('')}
    `;

    function fmtVal(val) {
      if (val === null || val === undefined || val === 0) return '<span style="color: var(--text-dim); font-family: var(--font-mono);">$0</span>';
      const isNeg = val < 0;
      const color = isNeg ? 'var(--status-rose)' : 'var(--status-emerald)';
      const sign = isNeg ? '-$' : '$';
      const formatted = Math.abs(val).toLocaleString();
      return `<span style="color: ${color}; font-weight: 600; font-family: var(--font-mono);">${sign}${formatted}</span>`;
    }

    const getVal = (carrierKey, rowKey, archiveProp, idx, yStr) => {
      const yNum = parseInt(yStr, 10);
      const arch = INGAME_FINANCE_ARCHIVE[yNum] || {};

      if (carrierKey && fin.transport && fin.transport[carrierKey]) {
        const cData = fin.transport[carrierKey];
        if (cData[rowKey] && cData[rowKey][idx] !== undefined) {
          return cData[rowKey][idx];
        }
      }
      if (carrierKey === 'INVESTMENT' && fin.investment && fin.investment[rowKey]) {
        if (fin.investment[rowKey][idx] !== undefined) {
          return fin.investment[rowKey][idx];
        }
      }
      if (carrierKey === 'OTHER' && fin.other && fin.other[rowKey]) {
        if (fin.other[rowKey][idx] !== undefined) {
          return fin.other[rowKey][idx];
        }
      }
      if (archiveProp && arch[archiveProp] !== undefined) {
        return arch[archiveProp];
      }
      return 0;
    };

    const getRoadTotal = (idx, yStr) => {
      if (fin.totalsByYear && fin.totalsByYear[idx] !== undefined && fin.totalsByYear[idx] !== 0) {
        return fin.totalsByYear[idx];
      }
      const yNum = parseInt(yStr, 10);
      const arch = INGAME_FINANCE_ARCHIVE[yNum];
      return arch ? arch.roadTotal : 0;
    };

    const rows = [
      {
        header: currentLang === 'de' ? 'Road (Straße & LKW/Busse)' : 'Road (Trucks & Busses)',
        isHeader: true,
        subtotal: years.map((y, idx) => getRoadTotal(idx, y)),
        children: [
          { name: 'Running Costs Vehicles', vals: years.map((y, idx) => getVal('ROAD', 'Running Costs Vehicles', 'runningCosts', idx, y)) },
          { name: 'Maintenance Vehicles', vals: years.map((y, idx) => getVal('ROAD', 'Maintenance Vehicles', 'maintenance', idx, y)) },
          { name: 'Upkeep Roads', vals: years.map((y, idx) => getVal('ROAD', 'Upkeep Roads', 'upkeepRoads', idx, y)) },
          { name: 'Upkeep Buildings', vals: years.map((y, idx) => getVal('ROAD', 'Upkeep Buildings', 'upkeepBuildings', idx, y)) },
          { name: 'Revenue', vals: years.map((y, idx) => getVal('ROAD', 'Revenue', 'revenue', idx, y)) }
        ]
      },
      {
        header: currentLang === 'de' ? 'Rail (Schiene)' : 'Rail (Trains & Stations)',
        isHeader: true,
        subtotal: years.map(() => 0),
        children: []
      },
      {
        header: currentLang === 'de' ? 'Allgemeine Fixkosten' : 'General Overheads',
        isHeader: true,
        subtotal: years.map((y, idx) => getVal('OTHER', 'Upkeep Warehouses', 'warehouses', idx, y)),
        children: [
          { name: 'Upkeep Warehouses', vals: years.map((y, idx) => getVal('OTHER', 'Upkeep Warehouses', 'warehouses', idx, y)) }
        ]
      },
      {
        header: currentLang === 'de' ? 'Investitionen & Neubauten' : 'Capital Investments',
        isHeader: true,
        subtotal: years.map((y, idx) => {
          const r = getVal('INVESTMENT', 'Roads', 'invRoads', idx, y);
          const i = getVal('INVESTMENT', 'Infrastructure', 'invInfra', idx, y);
          const w = getVal('INVESTMENT', 'Warehouses', 'invWarehouses', idx, y);
          const v = getVal('INVESTMENT', 'Vehicles', 'invVehicles', idx, y);
          return r + i + w + v;
        }),
        children: [
          { name: 'Roads (Straßenbau)', vals: years.map((y, idx) => getVal('INVESTMENT', 'Roads', 'invRoads', idx, y)) },
          { name: 'Tracks (Gleisbau)', vals: years.map(() => 0) },
          { name: 'Infrastructure (Stationen & Depots)', vals: years.map((y, idx) => getVal('INVESTMENT', 'Infrastructure', 'invInfra', idx, y)) },
          { name: 'Warehouses (Warenhäuser Bau)', vals: years.map((y, idx) => getVal('INVESTMENT', 'Warehouses', 'invWarehouses', idx, y)) },
          { name: 'Vehicles (Fahrzeugkäufe)', vals: years.map((y, idx) => getVal('INVESTMENT', 'Vehicles', 'invVehicles', idx, y)) }
        ]
      },
      {
        header: currentLang === 'de' ? 'Finanzierung & Kredite' : 'Financing & Debt',
        isHeader: true,
        subtotal: years.map((y, idx) => (fin.interestByYear && fin.interestByYear[idx] !== undefined) ? -Math.abs(fin.interestByYear[idx]) : 0),
        children: [
          { name: 'Loan (Kreditbestand)', vals: years.map((y, idx) => (fin.loanByYear && fin.loanByYear[idx] !== undefined) ? fin.loanByYear[idx] : (fin.loan || 0)) },
          { name: 'Interest (Zinsaufwand)', vals: years.map((y, idx) => (fin.interestByYear && fin.interestByYear[idx] !== undefined) ? -Math.abs(fin.interestByYear[idx]) : 0) }
        ]
      }
    ];

    let html = '';
    rows.forEach(sec => {
      html += `
        <tr style="background: rgba(30, 41, 59, 0.75); font-weight: 700; border-top: 1px solid var(--border-glass);">
          <td style="padding: 10px 16px; color: #fff;">
            <span>▾</span> <span style="margin-left: 6px;">${sec.header}</span>
          </td>
          ${years.map((y, idx) => `<td style="text-align: right; padding: 10px 16px;">${fmtVal(sec.subtotal[idx] || 0)}</td>`).join('')}
        </tr>
      `;
      (sec.children || []).forEach(child => {
        html += `
          <tr style="background: rgba(15, 23, 42, 0.35); border-bottom: 1px solid rgba(255, 255, 255, 0.03);">
            <td style="padding: 8px 16px 8px 36px; color: var(--text-muted); font-size: 0.84rem;">
              ${child.name}
            </td>
            ${years.map((y, idx) => `<td style="text-align: right; padding: 8px 16px; font-size: 0.84rem;">${fmtVal(child.vals[idx] || 0)}</td>`).join('')}
          </tr>
        `;
      });
    });

    tbody.innerHTML = html;
  }

  function renderTreasuryChart() {
    const canvas = document.getElementById('chartTreasuryCanvas');
    if (!canvas || !window.Chart) return;

    if (!chartTreasury) {
      const ctx = canvas.getContext('2d');
      chartTreasury = new Chart(ctx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'Treasury ($)',
            data: [],
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.12)',
            fill: true,
            spanGaps: false,
            tension: 0.2,
            borderWidth: 2.2,
            pointRadius: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  if (ctx.raw === null || ctx.raw === undefined) return '';
                  return `Balance: ${formatMoney(ctx.raw, false)}`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#64748b', font: { size: 10 }, maxTicksLimit: 8 }
            },
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: {
                color: '#64748b',
                font: { size: 10 },
                callback: function (val) { return formatMoney(val, false); }
              }
            }
          }
        }
      });
    }

    if (localTreasuryHistory.length === 0) return;

    const msMap = { '5m': 300000, '15m': 900000, '30m': 1800000, '1h': 3600000 };
    const windowMs = msMap[treasuryHorizon] || 300000;
    const now = Date.now();
    const windowStart = now - windowMs;
    const earliestTime = localTreasuryHistory[0].time;

    // Update Live Status Pill
    const statusPill = document.getElementById('treasuryHistoryStatusPill');
    if (statusPill) {
      const recSecTotal = Math.max(0, Math.round((now - earliestTime) / 1000));
      const m = Math.floor(recSecTotal / 60);
      const s = recSecTotal % 60;
      const timeStr = m > 0 ? `${m}m ${s}s` : `${s}s`;
      const totalPts = localTreasuryHistory.length;
      statusPill.innerHTML = currentLang === 'de'
        ? `💾 <strong>${totalPts} Datenpunkte</strong> (${timeStr} Historie) • Gespeichert in <span style="color:#fff;">telemetry_history.json</span>`
        : `💾 <strong>${totalPts} points</strong> (${timeStr} recorded) • Auto-saved to <span style="color:#fff;">telemetry_history.json</span>`;
    }

    // Generate fixed-time slots across windowMs to maintain true proportional width
    const NUM_SLOTS = 60;
    const slotMs = windowMs / NUM_SLOTS;
    const labels = [];
    const dataPoints = [];

    for (let i = 0; i <= NUM_SLOTS; i++) {
      const t = windowStart + (i * slotMs);

      // Find closest point within reasonable proximity
      let closest = null;
      let minDiff = Infinity;
      for (let j = 0; j < localTreasuryHistory.length; j++) {
        const diff = Math.abs(localTreasuryHistory[j].time - t);
        if (diff < minDiff) {
          minDiff = diff;
          closest = localTreasuryHistory[j];
        }
      }

      // X-Axis Game Calendar Date (USER REQUIREMENT!)
      if (closest && closest.gameDate) {
        labels.push(closest.gameDate);
      } else {
        const d = new Date(t);
        const mm = d.getMinutes().toString().padStart(2, '0');
        const ss = d.getSeconds().toString().padStart(2, '0');
        labels.push(`${mm}:${ss}`);
      }

      if (t < earliestTime - 3000) {
        dataPoints.push(null);
      } else {
        dataPoints.push(closest ? closest.balance : null);
      }
    }

    chartTreasury.data.labels = labels;
    chartTreasury.data.datasets[0].data = dataPoints;

    // Trend coloring
    const inWindow = localTreasuryHistory.filter(p => p.time >= windowStart);
    if (inWindow.length >= 2) {
      const delta = inWindow[inWindow.length - 1].balance - inWindow[0].balance;
      chartTreasury.data.datasets[0].borderColor = delta >= 0 ? '#10b981' : '#f43f5e';
      chartTreasury.data.datasets[0].backgroundColor = delta >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)';
    }

    chartTreasury.update('none');
  }

  // ==========================================================================
  // TAB 3: HAUPT-DASHBOARD / EXECUTIVE COCKPIT
  // ==========================================================================
  function renderCockpitCharts(data) {
    if (!window.Chart) return;
    const fin = data.finances || {};
    const pts = (localTreasuryHistory.length > 0) ? localTreasuryHistory : (fin.history || []);
    const netHistory = data.networkHistory || [];

    // Badges
    const badgeBal = document.getElementById('badgeCockpitBalance');
    if (badgeBal) badgeBal.textContent = formatMoney(fin.bankBalance || 0);

    const badgeLoan = document.getElementById('badgeCockpitLoan');
    if (badgeLoan) {
      const loan = fin.loan || 0;
      const interestM = fin.interestPerMonth || Math.round((loan * 0.015) / 12);
      badgeLoan.textContent = `${formatMoney(loan)} (Zins: ${formatMoney(interestM)}/M)`;
    }

    const badgeUtil = document.getElementById('badgeCockpitUtil');
    if (badgeUtil) badgeUtil.textContent = `${data.overallUtilization || 0}%`;

    if (pts.length === 0) return;

    // Use last 40 data points
    const recentPts = pts.slice(-40);
    const dateLabels = recentPts.map(p => {
      if (p.gameDate) return p.gameDate;
      const d = new Date(p.time);
      return `${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
    });

    // 1. Chart Balance
    const cvsBal = document.getElementById('chartCockpitBalance');
    if (cvsBal) {
      if (!chartCockpitBalance) {
        chartCockpitBalance = new Chart(cvsBal.getContext('2d'), {
          type: 'line',
          data: {
            labels: dateLabels,
            datasets: [{
              label: 'Kontostand ($)',
              data: recentPts.map(p => p.balance),
              borderColor: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              fill: true,
              tension: 0.25,
              borderWidth: 2,
              pointRadius: 1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 9 }, maxTicksLimit: 6 } },
              y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 9 }, callback: v => formatMoney(v) } }
            }
          }
        });
      } else {
        chartCockpitBalance.data.labels = dateLabels;
        chartCockpitBalance.data.datasets[0].data = recentPts.map(p => p.balance);
        const lastBal = recentPts[recentPts.length - 1].balance;
        chartCockpitBalance.data.datasets[0].borderColor = lastBal >= 0 ? '#10b981' : '#f43f5e';
        chartCockpitBalance.data.datasets[0].backgroundColor = lastBal >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)';
        chartCockpitBalance.update('none');
      }
    }

    // 2. Chart Loan & Interest
    const cvsLoan = document.getElementById('chartCockpitLoan');
    if (cvsLoan) {
      if (!chartCockpitLoan) {
        chartCockpitLoan = new Chart(cvsLoan.getContext('2d'), {
          type: 'line',
          data: {
            labels: dateLabels,
            datasets: [
              {
                label: 'Kredit ($)',
                data: recentPts.map(p => p.loan || 0),
                borderColor: '#f43f5e',
                backgroundColor: 'rgba(244, 63, 94, 0.08)',
                fill: true,
                tension: 0.2,
                borderWidth: 2,
                pointRadius: 1,
                yAxisID: 'y'
              },
              {
                label: 'Zinsen/Monat ($)',
                data: recentPts.map(p => p.interest ? Math.round(p.interest / 12) : Math.round((p.loan || 0) * 0.015 / 12)),
                borderColor: '#fbbf24',
                borderDash: [3, 3],
                borderWidth: 1.8,
                pointRadius: 0,
                yAxisID: 'yInterest'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: { legend: { display: true, labels: { color: '#94a3b8', font: { size: 9 } } } },
            scales: {
              x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 9 }, maxTicksLimit: 6 } },
              y: { position: 'left', grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#f43f5e', font: { size: 9 }, callback: v => formatMoney(v) } },
              yInterest: { position: 'right', grid: { display: false }, ticks: { color: '#fbbf24', font: { size: 9 }, callback: v => formatMoney(v) } }
            }
          }
        });
      } else {
        chartCockpitLoan.data.labels = dateLabels;
        chartCockpitLoan.data.datasets[0].data = recentPts.map(p => p.loan || 0);
        chartCockpitLoan.data.datasets[1].data = recentPts.map(p => p.interest ? Math.round(p.interest / 12) : Math.round((p.loan || 0) * 0.015 / 12));
        chartCockpitLoan.update('none');
      }
    }

    // 3. Chart Network Utilization
    const cvsUtil = document.getElementById('chartCockpitUtil');
    if (cvsUtil && netHistory.length > 0) {
      const recentNet = netHistory.slice(-40);
      const utilLabels = recentNet.map(p => {
        if (p.gameDate) return p.gameDate;
        const d = new Date(p.time);
        return `${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
      });

      if (!chartCockpitUtil) {
        chartCockpitUtil = new Chart(cvsUtil.getContext('2d'), {
          type: 'line',
          data: {
            labels: utilLabels,
            datasets: [{
              label: 'Auslastung %',
              data: recentNet.map(p => p.utilization || 0),
              borderColor: '#a855f7',
              backgroundColor: 'rgba(168, 85, 247, 0.15)',
              fill: true,
              tension: 0.25,
              borderWidth: 2,
              pointRadius: 1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 9 }, maxTicksLimit: 6 } },
              y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 9 }, callback: v => `${v}%` } }
            }
          }
        });
      } else {
        chartCockpitUtil.data.labels = utilLabels;
        chartCockpitUtil.data.datasets[0].data = recentNet.map(p => p.utilization || 0);
        chartCockpitUtil.update('none');
      }
    }
  }

  function renderTransferSuggestions(data) {
    const container = document.getElementById('transferSuggestionsContainer');
    if (!container) return;

    const suggestions = data.transferSuggestions || [];
    if (suggestions.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 18px 22px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: var(--radius-md); display: flex; align-items: center; gap: 14px;">
          <span style="font-size: 1.8rem;">✅</span>
          <div>
            <strong style="color: var(--status-emerald); font-size: 0.95rem;">Flotten optimal ausbalanciert</strong>
            <div style="font-size: 0.8rem; color: #cbd5e1; margin-top: 2px;">
              Aktuell gibt es keine unausgelasteten Spenderlinien mit zeitgleichem Stau auf Empfängerlinien. Keine Fahrzeug-Verschiebungen erforderlich ($0 Investition).
            </div>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = suggestions.map(s => `
      <div class="panel-box" style="padding: 14px 18px; border-left: 4px solid ${s.urgency === 'HIGH' ? 'var(--status-rose)' : 'var(--status-amber)'}; background: rgba(15, 23, 42, 0.85);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <strong style="color: #fff; font-size: 0.94rem;">💡 ${escapeHtml(s.title)}</strong>
          <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: var(--status-emerald); border: 1px solid rgba(16, 185, 129, 0.35); font-weight: 700;">
            $0 Investition
          </span>
        </div>
        <div style="font-size: 0.82rem; color: #cbd5e1; line-height: 1.45; margin-bottom: 10px;">
          ${escapeHtml(s.reason)}
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 4px; font-size: 0.76rem;">
          <span style="color: var(--status-emerald); font-weight: 600;">✨ ${escapeHtml(s.benefit)}</span>
          <button class="btn btn-glass" style="font-size: 0.74rem; padding: 3px 8px;" onclick="window.dashboard.openRouteDetails(${s.fromLineId})">
            Linie anzeigen ➔
          </button>
        </div>
      </div>
    `).join('');
  }

  function renderWarehouseMonitor(data) {
    const tbody = document.getElementById('warehouseTableBody');
    if (!tbody) return;

    let stations = data.stations || [];
    const countBadge = document.getElementById('badgeWarehouseCount');
    if (countBadge) countBadge.textContent = stations.length;

    // Filter by type / status
    if (warehouseFilter === 'OVERFLOW') {
      stations = stations.filter(s => s.status === 'OVERFLOW');
    } else if (warehouseFilter === 'UNDERUTILIZED') {
      stations = stations.filter(s => s.status === 'UNDERUTILIZED');
    } else if (warehouseFilter === 'CARGO') {
      stations = stations.filter(s => s.isCargo);
    }

    // Filter by search
    if (warehouseSearchQuery) {
      const q = warehouseSearchQuery.toLowerCase();
      stations = stations.filter(s => (s.name && s.name.toLowerCase().includes(q)) || (s.town && s.town.toLowerCase().includes(q)));
    }

    if (stations.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-dim);">${currentLang === 'de' ? 'Keine Stationen/Warenhäuser für diesen Filter gefunden.' : 'No stations found.'}</td></tr>`;
      return;
    }

    tbody.innerHTML = stations.map(s => {
      const isPax = s.isPax;
      const typeBadge = isPax
        ? `<span class="badge" style="background: rgba(6,182,212,0.15); color: var(--accent-cyan);">👥 Personen</span>`
        : `<span class="badge" style="background: rgba(168,85,247,0.15); color: #d8b4fe;">📦 Warenhaus</span>`;

      let statBadge = '';
      if (s.status === 'OVERFLOW') {
        statBadge = `<span class="badge" style="background: rgba(244,63,94,0.2); color: var(--status-rose); border: 1px solid rgba(244,63,94,0.4); font-weight: 700;">🔴 ZU KLEIN (Stau!)</span>`;
      } else if (s.status === 'BUSY') {
        statBadge = `<span class="badge" style="background: rgba(245,158,11,0.2); color: var(--status-amber); border: 1px solid rgba(245,158,11,0.4); font-weight: 700;">🟡 Hohe Auslastung</span>`;
      } else if (s.status === 'UNDERUTILIZED') {
        statBadge = `<span class="badge" style="background: rgba(148,163,184,0.15); color: #94a3b8; border: 1px solid rgba(148,163,184,0.3);">🟢 ZU GROSS (Geringer Durchsatz)</span>`;
      } else {
        statBadge = `<span class="badge" style="background: rgba(16,185,129,0.15); color: var(--status-emerald); border: 1px solid rgba(16,185,129,0.3);">⚖️ Optimal</span>`;
      }

      const linesStr = (s.lines && s.lines.length > 0) ? s.lines.join(', ') : 'Keine';

      return `
        <tr style="background: rgba(15, 23, 42, 0.35); border-bottom: 1px solid rgba(255, 255, 255, 0.04);">
          <td style="padding: 9px 14px; font-weight: 600; color: #fff;">
            ${escapeHtml(s.name)}
            ${s.town ? `<div style="font-size: 0.72rem; color: var(--text-dim); font-weight: normal;">📍 ${escapeHtml(s.town)}</div>` : ''}
          </td>
          <td style="padding: 9px 14px;">${typeBadge}</td>
          <td style="padding: 9px 14px; text-align: right; font-family: var(--font-mono); font-weight: 700; color: ${s.liveWaiting >= 40 ? 'var(--status-rose)' : (s.liveWaiting >= 15 ? 'var(--status-amber)' : '#fff')};">
            ${(s.liveWaiting || 0).toLocaleString()} ${isPax ? 'Pax' : 'Fracht'}
          </td>
          <td style="padding: 9px 14px; text-align: right; font-family: var(--font-mono); color: var(--text-muted);">
            ${(s.avgWaiting5m || 0).toLocaleString()}
          </td>
          <td style="padding: 9px 14px; text-align: center;">${statBadge}</td>
          <td style="padding: 9px 14px; font-size: 0.76rem; color: var(--text-muted); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(linesStr)}">
            ${escapeHtml(linesStr)}
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderCockpitView(data) {
    renderCockpitCharts(data);
    renderTransferSuggestions(data);
    renderWarehouseMonitor(data);

    function getLineCashByUnit(l) {
      if (selectedUnit === 'year') {
        const val = (l.lineAvgPerYear || (l.sessionTotalCashflow ? 0 : Math.round((l.cashflow60s || 0) * 525600 / 60)));
        return { val, formatted: `${formatMoney(val, true)}/J` };
      }
      if (selectedUnit === 'month') {
        const val = (l.lineAvgPerMonth || (l.sessionTotalCashflow ? 0 : Math.round((l.cashflow60s || 0) * 43800 / 60)));
        return { val, formatted: `${formatMoney(val, true)}/M` };
      }
      if (selectedUnit === 'day') {
        const val = (l.lineAvgPerDay || (l.sessionTotalCashflow ? 0 : Math.round((l.cashflow60s || 0) * 1440 / 60)));
        return { val, formatted: `${formatMoney(val, true)}/T` };
      }
      return { val: l.cashflow60s || 0, formatted: `${formatMoney(l.cashflow60s || 0, true)}/m` };
    }

    const allLines = data.lines || [];

    const listTop = document.getElementById('listTopEarners');
    if (listTop) {
      const earners = allLines.filter(l => getLineCashByUnit(l).val > 0)
        .sort((a, b) => getLineCashByUnit(b).val - getLineCashByUnit(a).val)
        .slice(0, 5);

      if (earners.length === 0) {
        listTop.innerHTML = `<div style="color: var(--text-dim); text-align: center; padding: 20px;">${currentLang === 'de' ? 'Keine Linien im Plus.' : 'No profitable lines.'}</div>`;
      } else {
        listTop.innerHTML = earners.map((l, i) => {
          const cash = getLineCashByUnit(l);
          return `
          <div class="rank-item" onclick="window.dashboard.openRouteDetails(${l.id})">
            <span class="rank-pos ${i === 0 ? 'gold' : ''}">#${i + 1}</span>
            <div class="rank-info">
              <div class="rank-name">${escapeHtml(l.name)}</div>
              <div class="rank-sub">${l.carrierCategory} • ${l.vehicleCount} units • Util: ${l.avgUtil60s || l.utilization || 0}%</div>
            </div>
            <div class="rank-val" style="color: var(--status-emerald);">${cash.formatted}</div>
          </div>
        `;
        }).join('');
      }
    }

    const listFlop = document.getElementById('listTopLosers');
    if (listFlop) {
      const losers = allLines.filter(l => getLineCashByUnit(l).val < 0)
        .sort((a, b) => getLineCashByUnit(a).val - getLineCashByUnit(b).val)
        .slice(0, 5);

      if (losers.length === 0) {
        listFlop.innerHTML = `<div style="color: var(--text-dim); text-align: center; padding: 20px;">${currentLang === 'de' ? 'Keine Verlustlinien.' : 'No losing lines.'}</div>`;
      } else {
        listFlop.innerHTML = losers.map((l, i) => {
          const cash = getLineCashByUnit(l);
          return `
          <div class="rank-item" onclick="window.dashboard.openRouteDetails(${l.id})">
            <span class="rank-pos" style="background: rgba(244, 63, 94, 0.2); color: var(--status-rose);">#${i + 1}</span>
            <div class="rank-info">
              <div class="rank-name">${escapeHtml(l.name)}</div>
              <div class="rank-sub">${l.carrierCategory} • Util: ${l.avgUtil60s || l.utilization || 0}%</div>
            </div>
            <div class="rank-val" style="color: var(--status-rose);">${cash.formatted}</div>
          </div>
        `;
        }).join('');
      }
    }

    const probContainer = document.getElementById('problemLinesContainer');
    if (probContainer) {
      let problems = data.problemLines || [];

      // Update City Filter Dropdown options
      const citySelect = document.getElementById('warnCitySelect');
      if (citySelect) {
        const allTowns = new Set();
        (data.lines || []).forEach(l => (l.towns || []).forEach(t => allTowns.add(t)));
        const sortedTowns = Array.from(allTowns).sort();
        const curSelected = warnCityFilter;
        citySelect.innerHTML = `<option value="ALL">🏙️ ${currentLang === 'de' ? 'Alle Städte' : 'All Cities'}</option>` +
          sortedTowns.map(t => `<option value="${escapeHtml(t)}" ${t === curSelected ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('');
      }

      // Filter by Type (Cargo / Pax)
      const lineIsPax = (l) => (l.vehicleAdvice ? !!l.vehicleAdvice.isPax : (!!l.isOpnv || l.carrierCategory === 'ROAD_PERSON'));
      if (warnTypeFilter === 'PAX') {
        problems = problems.filter(l => lineIsPax(l));
      } else if (warnTypeFilter === 'CARGO') {
        problems = problems.filter(l => !lineIsPax(l));
      }

      // Filter by City
      if (warnCityFilter !== 'ALL') {
        problems = problems.filter(l => (l.towns || []).includes(warnCityFilter));
      }

      const badgeProb = document.getElementById('badgeProblemCount');
      if (badgeProb) badgeProb.textContent = problems.length;

      if (problems.length === 0) {
        probContainer.innerHTML = `<div style="color: var(--text-dim); text-align: center; padding: 20px; grid-column: 1 / -1;">${currentLang === 'de' ? 'Keine Engpässe für diesen Filter.' : 'No bottlenecks found matching active filters.'}</div>`;
      } else {
        probContainer.innerHTML = problems.map(l => {
          const recText = currentLang === 'de' ? l.recommendation : (l.recommendationEn || l.recommendation);
          const statText = currentLang === 'de' ? l.statusText : (l.statusTextEn || l.statusText);
          return `
            <div class="problem-card ${l.statusLevel || 'warn'}" onclick="window.dashboard.openRouteDetails(${l.id})">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                <strong style="color: #fff; font-size: 0.92rem; line-height: 1.25;">${escapeHtml(l.name)}</strong>
                <span class="badge-state ${l.statusLevel || 'warn'}">${statText}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.74rem; color: var(--text-muted); font-family: var(--font-mono); margin-top: 2px;">
                <span>${l.carrierCategory || l.carrier} • ${l.vehicleCount} ${currentLang === 'de' ? 'Fzg' : 'units'}</span>
                <span style="color: ${l.cashflow60s >= 0 ? 'var(--status-emerald)' : 'var(--status-rose)'}; font-weight: 700;">${formatMoney(l.cashflow60s, true)}/m</span>
              </div>
              <div style="font-size: 0.78rem; color: #cbd5e1; background: rgba(0,0,0,0.3); padding: 6px 10px; border-radius: 4px; line-height: 1.35; margin-top: 4px;">
                💡 ${escapeHtml(recText || 'Check route configuration')}
              </div>
            </div>
          `;
        }).join('');
      }
    }
  }

  // ==========================================================================
  // TAB 4: WALL OF CHARTS (ALL 6 CHARTS LIVE)
  // ==========================================================================
  function renderWallOfCharts(data) {
    if (!window.Chart) return;
    const history = data.networkHistory || [];
    if (history.length === 0) return;

    const msMap = { '1m': 60000, '5m': 300000, '15m': 900000, '30m': 1800000, '1h': 3600000 };
    const maxAge = msMap[chartHorizon] || 60000;
    const now = Date.now();
    const pts = history.filter(p => (now - p.time) <= maxAge);
    if (pts.length === 0) return;

    const labels = pts.map(p => {
      if (p.gameDate) return p.gameDate;
      const d = new Date(p.time);
      return `${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
    });

    function getOrCreateChart(chartVar, canvasId, config) {
      if (chartVar) return chartVar;
      const cvs = document.getElementById(canvasId);
      if (!cvs) return null;
      return new Chart(cvs.getContext('2d'), config);
    }

    // Chart 1: Top 5 Earners
    const top5 = (data.topEarners || []).slice(0, 5);
    chartWallTop5 = getOrCreateChart(chartWallTop5, 'chartWallTop5', {
      type: 'bar',
      data: {
        labels: top5.map(l => l.name.length > 20 ? l.name.substring(0, 18) + '…' : l.name),
        datasets: [{
          label: 'Cashflow/m',
          data: top5.map(l => l.cashflow60s || 0),
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderColor: '#10b981',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 10 } } },
          y: { grid: { display: false }, ticks: { color: '#e2e8f0', font: { size: 10 } } }
        }
      }
    });
    if (chartWallTop5) {
      chartWallTop5.data.labels = top5.map(l => l.name.length > 20 ? l.name.substring(0, 18) + '…' : l.name);
      chartWallTop5.data.datasets[0].data = top5.map(l => l.cashflow60s || 0);
      chartWallTop5.update('none');
    }

    // Chart 2: Top 5 Loss-Makers (Flop 5)
    const flop5 = (data.topLosers || []).slice(0, 5);
    chartWallFlop5 = getOrCreateChart(chartWallFlop5, 'chartWallFlop5', {
      type: 'bar',
      data: {
        labels: flop5.map(l => l.name.length > 20 ? l.name.substring(0, 18) + '…' : l.name),
        datasets: [{
          label: 'Deficit/m',
          data: flop5.map(l => l.cashflow60s || 0),
          backgroundColor: 'rgba(244, 63, 94, 0.7)',
          borderColor: '#f43f5e',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 10 } } },
          y: { grid: { display: false }, ticks: { color: '#e2e8f0', font: { size: 10 } } }
        }
      }
    });
    if (chartWallFlop5) {
      chartWallFlop5.data.labels = flop5.map(l => l.name.length > 20 ? l.name.substring(0, 18) + '…' : l.name);
      chartWallFlop5.data.datasets[0].data = flop5.map(l => l.cashflow60s || 0);
      chartWallFlop5.update('none');
    }

    // Chart 3: Volume & Capacity
    chartWallVolume = getOrCreateChart(chartWallVolume, 'chartWallVolume', {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label: 'Load', data: [], borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.15)', fill: true, tension: 0.3, pointRadius: 0 },
          { label: 'Capacity', data: [], borderColor: '#a855f7', borderDash: [4, 4], pointRadius: 0 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: true } } }
    });
    if (chartWallVolume) {
      chartWallVolume.data.labels = labels;
      chartWallVolume.data.datasets[0].data = pts.map(p => p.load);
      chartWallVolume.data.datasets[1].data = pts.map(p => p.capacity);
      chartWallVolume.update('none');
    }

    // Chart 4: Waiting Backlogs
    chartWallWaiting = getOrCreateChart(chartWallWaiting, 'chartWallWaiting', {
      type: 'line',
      data: {
        labels: [],
        datasets: [{ label: 'Waiting', data: [], borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.15)', fill: true, tension: 0.3, pointRadius: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } } }
    });
    if (chartWallWaiting) {
      chartWallWaiting.data.labels = labels;
      chartWallWaiting.data.datasets[0].data = pts.map(p => p.waiting);
      chartWallWaiting.update('none');
    }

    // Chart 5: Speed
    chartWallSpeed = getOrCreateChart(chartWallSpeed, 'chartWallSpeed', {
      type: 'line',
      data: {
        labels: [],
        datasets: [{ label: 'Speed (km/h)', data: [], borderColor: '#10b981', tension: 0.3, pointRadius: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } } }
    });
    if (chartWallSpeed) {
      chartWallSpeed.data.labels = labels;
      chartWallSpeed.data.datasets[0].data = pts.map(p => p.speed);
      chartWallSpeed.update('none');
    }

    // Chart 6: Fleet Maintenance
    chartWallMaint = getOrCreateChart(chartWallMaint, 'chartWallMaint', {
      type: 'line',
      data: {
        labels: [],
        datasets: [{ label: 'Condition %', data: [], borderColor: '#38bdf8', tension: 0.3, pointRadius: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } } }
    });
    if (chartWallMaint) {
      chartWallMaint.data.labels = labels;
      chartWallMaint.data.datasets[0].data = pts.map(p => p.maint);
      chartWallMaint.update('none');
    }
  }

  // ==========================================================================
  // TAB 5: AI INSIGHTS & FORECASTING
  // ==========================================================================
  function renderPatternsAndForecasting(data) {
    const alertsContainer = document.getElementById('patternCardsContainer');

    // Line -> Line reassignment block above the pattern cards
    if (alertsContainer) {
      let transferBox = document.getElementById('lineTransferContainer');
      if (!transferBox) {
        transferBox = document.createElement('div');
        transferBox.id = 'lineTransferContainer';
        transferBox.className = 'transfer-list';
        alertsContainer.parentNode.insertBefore(transferBox, alertsContainer);
      }
      const transfers = computeLineTransfers(data.lines || []);
      transferBox.innerHTML = transfers.length > 0
        ? renderTransferCards(transfers, false)
        : `<div class="advisor-section-title">🔁 ${currentLang === 'de' ? 'Fahrzeuge umverteilen (Linie ➔ Linie)' : 'Reassign vehicles (line ➔ line)'}</div>
           <div style="color: var(--text-dim); font-size: 0.82rem; padding: 6px 0 12px;">${currentLang === 'de' ? 'Aktuell keine sinnvolle Umverteilung – keine passende Linie mit freien Fahrzeugen gleichen Typs.' : 'No useful reassignment right now – no matching line with spare vehicles of the same type.'}</div>`;
    }

    const tagLabel = (tag) => {
      const map = {
        DEFICIT_SPIRAL: { de: 'Verlust', en: 'Deficit' },
        CASH_CHAMPION: { de: 'Top-Verdiener', en: 'Top earner' },
        BOTTLENECK: { de: 'Engpass', en: 'Bottleneck' },
        GHOST_FLEET: { de: 'Leerfahrten', en: 'Empty runs' },
        AGING_FLEET: { de: 'Veraltet', en: 'Aging' }
      };
      const m = map[tag];
      return m ? m[currentLang] || m.en : String(tag || '').replace(/_/g, ' ');
    };
    const cleanRec = (t) => String(t || '').replace(/\s*\((saves ~\$0\/yr|spart ca\. \$0\/J)\)/g, '');

    if (alertsContainer) {
      const alerts = data.patternAlerts || [];
      const badgePat = document.getElementById('badgePatternCount');
      if (badgePat) badgePat.textContent = alerts.length;

      if (alerts.length === 0) {
        alertsContainer.innerHTML = `<div style="color: var(--text-dim); text-align: center; padding: 20px; grid-column: 1 / -1;">${currentLang === 'de' ? 'Keine Anomalien oder Gefahrenmuster erkannt.' : 'Zero anomalies or danger patterns detected.'}</div>`;
      } else {
        alertsContainer.innerHTML = alerts.map(a => {
          const recText = cleanRec(currentLang === 'de' ? a.recommendation : (a.recommendationEn || a.recommendation));
          return `
            <div class="problem-card ${a.severity}" onclick="window.dashboard.openRouteDetails(${a.lineId})">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                <strong style="color: #fff; font-size: 0.92rem; line-height: 1.25;">${escapeHtml(a.lineName)}</strong>
                <span class="badge-state ${a.severity}" style="white-space: nowrap; flex-shrink: 0;">${tagLabel(a.tag)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.74rem; color: var(--text-muted); font-family: var(--font-mono); margin-top: 2px;">
                <span>${a.carrier}</span>
                <span style="color: ${a.cashflow60s >= 0 ? 'var(--status-emerald)' : 'var(--status-rose)'}; font-weight: 700;">${formatMoney(a.cashflow60s, true)}/m</span>
              </div>
              <div style="font-size: 0.78rem; color: #cbd5e1; background: rgba(0,0,0,0.3); padding: 6px 10px; border-radius: 4px; line-height: 1.35; margin-top: 4px;">
                💡 ${escapeHtml(recText)}
              </div>
            </div>
          `;
        }).join('');
      }
    }

    const tbody = document.getElementById('projectionsTableBody');
    if (tbody) {
      const lines = [...(data.lines || [])].sort((a, b) => (b.proj1h || 0) - (a.proj1h || 0));
      tbody.innerHTML = lines.map(l => `
        <tr onclick="window.dashboard.openRouteDetails(${l.id})" style="cursor: pointer;">
          <td style="font-weight: 700; color: #fff;">${escapeHtml(l.name)}</td>
          <td><span class="carrier-tag tag-cargo">${l.carrierCategory || l.carrier}</span></td>
          <td class="td-mono" style="color: ${l.cashflow60s >= 0 ? 'var(--status-emerald)' : 'var(--status-rose)'}; font-weight: 700;">${formatMoney(l.cashflow60s, true)}/m</td>
          <td class="td-mono">${formatMoney(l.proj5m, true)}</td>
          <td class="td-mono">${formatMoney(l.proj10m, true)}</td>
          <td class="td-mono">${formatMoney(l.proj30m, true)}</td>
          <td class="td-mono" style="font-weight: 700; color: ${l.proj1h >= 0 ? 'var(--status-emerald)' : 'var(--status-rose)'};">${formatMoney(l.proj1h, true)}</td>
          <td><span class="badge-state ${l.patternSeverity || 'info'}">${l.patternTag || 'STABLE'}</span></td>
          <td style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(l.recommendation)}</td>
        </tr>
      `).join('');
    }
  }

  // ==========================================================================
  // TAB 6: ROUTE DEEP-DIVE INSPECTOR
  // ==========================================================================
  function renderRouteInspector(data) {
    const container = document.getElementById('inspectorDetailsContent');
    if (!container) return;

    if (!selectedRouteId) {
      container.innerHTML = `<div style="color: var(--text-dim); text-align: center; padding: 40px;">${currentLang === 'de' ? 'Wähle eine Linie oben aus oder klicke in der Matrix auf Details.' : 'Select a route above or click Inspect in the fleet operations matrix.'}</div>`;
      return;
    }

    const line = (data.lines || []).find(l => l.id === selectedRouteId);
    if (!line) {
      container.innerHTML = `<div style="color: var(--text-dim); text-align: center; padding: 40px;">Route ID #${selectedRouteId} not found.</div>`;
      return;
    }

    let adviceHtml = '';
    const va = line.vehicleAdvice;
    if (va && va.action && va.action !== 'OK') {
      const actionMap = {
        SWAP: {
          title: currentLang === 'de' ? '🔄 Flottentausch empfohlen' : '🔄 Fleet Swap Recommended',
          color: '#38bdf8',
          bg: 'rgba(56, 189, 248, 0.15)',
          border: 'rgba(56, 189, 248, 0.35)',
          badge: currentLang === 'de' ? 'Kosten-Senker' : 'Cost Reducer'
        },
        UPGRADE: {
          title: currentLang === 'de' ? '🚀 Kapazitäts-Upgrade empfohlen' : '🚀 Capacity Upgrade Recommended',
          color: 'var(--status-emerald)',
          bg: 'rgba(16, 185, 129, 0.15)',
          border: 'rgba(16, 185, 129, 0.35)',
          badge: currentLang === 'de' ? 'Stau-Auflöser' : 'Backlog Clearer'
        },
        ADD: {
          title: currentLang === 'de' ? '➕ Weiteres Fahrzeug einsetzen' : '➕ Add Additional Unit',
          color: '#fbbf24',
          bg: 'rgba(251, 191, 36, 0.15)',
          border: 'rgba(251, 191, 36, 0.35)',
          badge: currentLang === 'de' ? 'Taktverdichtung' : 'Frequency Boost'
        },
        REMOVE: {
          title: currentLang === 'de' ? '➖ Leerfahrten abbauen / Fahrzeug abziehen' : '➖ Downsize / Remove Unit',
          color: 'var(--status-rose)',
          bg: 'rgba(244, 63, 94, 0.15)',
          border: 'rgba(244, 63, 94, 0.35)',
          badge: currentLang === 'de' ? 'Überkapazität' : 'Overcapacity'
        }
      };

      const actConfig = actionMap[va.action] || {
        title: currentLang === 'de' ? '💡 Optimierungsempfehlung' : '💡 Fleet Recommendation',
        color: '#38bdf8',
        bg: 'rgba(56, 189, 248, 0.15)',
        border: 'rgba(56, 189, 248, 0.35)',
        badge: 'Advisor'
      };

      const reasonText = currentLang === 'de'
        ? (va.reason || line.recommendation || '')
        : (va.reasonEn || va.reason || line.recommendationEn || line.recommendation || '');

      const savingsYear = va.potentialSavingsYear || line.potentialSavingsYear || 0;
      const savingsStr = savingsYear > 0
        ? (currentLang === 'de'
            ? `💵 Potenzielle Ersparnis: ca. ${formatMoney(savingsYear)} / Jahr (${formatMoney(Math.round(savingsYear / 12))} / Monat)`
            : `💵 Potential Savings: ~${formatMoney(savingsYear)} / yr (${formatMoney(Math.round(savingsYear / 12))} / mo)`)
        : '';

      adviceHtml = `
        <div class="panel-box" style="margin-bottom: 20px; border-left: 4px solid ${actConfig.color}; background: rgba(15, 23, 42, 0.9); box-shadow: 0 4px 20px rgba(0,0,0,0.35);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.5rem;">🧠</span>
              <div>
                <strong style="color: #fff; font-size: 1.05rem;">${actConfig.title}</strong>
                <div style="font-size: 0.76rem; color: var(--text-dim);">${currentLang === 'de' ? 'Linien- & Fahrzeug-Berater Analyse' : 'Fleet Advisor Diagnostic'}</div>
              </div>
            </div>
            <span class="badge" style="background: ${actConfig.bg}; color: ${actConfig.color}; border: 1px solid ${actConfig.border}; font-weight: 700; font-size: 0.82rem; padding: 4px 12px;">
              ${actConfig.badge}
            </span>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-around; background: rgba(0,0,0,0.28); border-radius: var(--radius-md); padding: 14px; margin-bottom: 12px; flex-wrap: wrap; gap: 12px;">
            <div style="text-align: center;">
              <div style="font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700;">${currentLang === 'de' ? 'Aktuelles Modell' : 'Current Model'}</div>
              <div style="font-weight: 700; color: #cbd5e1; font-size: 0.95rem; margin-top: 2px;">${escapeHtml(va.currentModel || va.currentShort || 'Bestehende Flotte')}</div>
              <div style="font-size: 0.76rem; color: var(--text-muted); font-family: var(--font-mono);">${va.currentCount || line.vehicleCount || 1}x Einheiten</div>
            </div>
            <div style="font-size: 1.5rem; color: var(--accent-cyan); font-weight: 800;">➔</div>
            <div style="text-align: center;">
              <div style="font-size: 0.72rem; color: var(--accent-cyan); text-transform: uppercase; font-weight: 700;">${currentLang === 'de' ? 'Empfohlenes Zielmodell' : 'Target Model'}</div>
              <div style="font-weight: 800; color: #38bdf8; font-size: 0.95rem; margin-top: 2px;">${escapeHtml(va.targetModel || va.targetShort || 'Neues Modell')}</div>
              <div style="font-size: 0.76rem; color: var(--status-emerald); font-family: var(--font-mono); font-weight: 700;">${va.recommendedCount || line.vehicleCount || 1}x Einheiten</div>
            </div>
          </div>

          <div style="background: rgba(255,255,255,0.03); padding: 12px 14px; border-radius: 6px; font-size: 0.84rem; color: #e2e8f0; line-height: 1.5; margin-bottom: 12px;">
            💡 <strong>${currentLang === 'de' ? 'Begründung & Diagnose:' : 'Diagnosis & Rationale:'}</strong> ${escapeHtml(reasonText)}
            ${savingsStr ? `<div style="margin-top: 6px; color: var(--status-emerald); font-weight: 700; font-family: var(--font-mono);">${savingsStr}</div>` : ''}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.76rem; color: var(--text-muted); border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;">
            <span>🎮 <em>${currentLang === 'de' ? 'TF3 Schritt: Linie auswählen ➔ Fahrzeuge verwalten ➔ Fahrzeuge ersetzen' : 'TF3: Select Line ➔ Manage Vehicles ➔ Replace'}</em></span>
            <button class="btn btn-glass" onclick="window.dashboard.openVehicleAdviceModal(${line.id})" style="font-size: 0.76rem; padding: 4px 12px; color: var(--accent-cyan);">
              🔍 ${currentLang === 'de' ? 'Im Berater öffnen' : 'Open Advisor Modal'}
            </button>
          </div>
        </div>
      `;
    }

    // Keep activeRouteHistory cache updated
    if (!routeHistoryCache[line.id]) {
      routeHistoryCache[line.id] = [];
      fetchRouteHistory(line.id);
    }

    const curUtil = line.liveUtil !== undefined ? line.liveUtil : (line.avgUtil60s || line.utilization || 0);
    const barClass = curUtil >= 70 ? 'fill-green' : (curUtil >= 30 ? 'fill-amber' : 'fill-rose');
    const isPax = !!line.isOpnv || line.carrierCategory === 'ROAD_PERSON';
    const unitLabel = isPax ? 'Pax' : (currentLang === 'de' ? 'Fracht' : 'Cargo');
    const waitCount = line.totalWaiting || 0;

    // Sparkline points
    const sparkPoints = (line.sparklineUtil && line.sparklineUtil.length > 0) ? line.sparklineUtil : [curUtil, curUtil];
    const minUtil = Math.min(...sparkPoints);
    const maxUtil = Math.max(...sparkPoints);
    const sparkSvgLarge = renderSparklineSvg(sparkPoints, 220, 42);

    // Period cashflows
    const cashYear = line.lineAvgPerYear || (line.cashflow60s * 525600 / 60);
    const cashMonth = line.lineAvgPerMonth || (line.cashflow60s * 43800 / 60);
    const cashDay = line.lineAvgPerDay || (line.cashflow60s * 1440 / 60);
    let curCash = line.cashflow60s || 0;
    let cashUnit = '/m';
    if (selectedUnit === 'year') {
      curCash = cashYear;
      cashUnit = '/J';
    } else if (selectedUnit === 'month') {
      curCash = cashMonth;
      cashUnit = '/M';
    } else if (selectedUnit === 'day') {
      curCash = cashDay;
      cashUnit = '/T';
    }

    // Carrier badge
    let carrierTagClass = 'tag-pax';
    let carrierTagText = '🚌 PASSENGER';
    if (line.carrierCategory === 'ROAD_CARGO' || (!line.isOpnv && line.carrier === 'ROAD')) {
      carrierTagClass = 'tag-cargo';
      carrierTagText = '🚚 ROAD CARGO';
    } else if (line.carrier === 'RAIL') {
      carrierTagClass = 'tag-rail';
      carrierTagText = '🚆 RAIL';
    } else if (line.carrier === 'WATER') {
      carrierTagClass = 'tag-water';
      carrierTagText = '🚢 WATER';
    } else if (line.carrier === 'AIR') {
      carrierTagClass = 'tag-air';
      carrierTagText = '✈️ AIR';
    }

    // Towns corridor
    const townsStr = (line.towns && line.towns.length > 0) ? line.towns.join(' ➔ ') : '';

    container.innerHTML = `
      <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid var(--border-glass); border-radius: var(--radius-lg); padding: 20px;">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <h2 style="font-size: 1.35rem; font-weight: 800; color: #fff; margin: 0;">${escapeHtml(line.name)}</h2>
              <span class="carrier-tag ${carrierTagClass}">${carrierTagText}</span>
              ${line.cargoType ? `<span style="background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 4px; font-size: 0.76rem; color: var(--accent-cyan); font-family: var(--font-mono);">📦 ${escapeHtml(line.cargoType)}</span>` : ''}
            </div>
            <div style="font-size: 0.82rem; color: var(--text-muted); font-family: var(--font-mono); margin-top: 4px;">
              ID: ${line.id} • ${townsStr ? `📍 ${escapeHtml(townsStr)} • ` : ''}${line.vehicleCount || 0} ${currentLang === 'de' ? 'Fahrzeuge' : 'units'} • Ø ${formatAge(line.avgAgeYears)}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.45rem; font-weight: 800; font-family: var(--font-mono); color: ${curCash >= 0 ? 'var(--status-emerald)' : 'var(--status-rose)'};">
              ${formatMoney(curCash, true)}${cashUnit}
            </div>
            <div style="font-size: 0.74rem; color: var(--text-dim); font-family: var(--font-mono);">
              ${currentLang === 'de' ? 'Operativer Ertrag' : 'Operating Earnings'}
            </div>
          </div>
        </div>

        ${adviceHtml}

        <!-- 4 Table-Style Quick Graphs & Live Indicators -->
        <div class="route-graphs-grid">
          
          <!-- Graph Card 1: Auslastungs-Verlauf (Sparkline & Trend) -->
          <div class="route-graph-card">
            <div class="route-graph-card-header">
              <span class="route-graph-card-title">📈 ${currentLang === 'de' ? 'Auslastungs-Verlauf' : 'Utilization Sparkline'}</span>
              <span class="route-graph-card-badge" style="color: ${curUtil >= 65 ? 'var(--status-emerald)' : (curUtil >= 25 ? 'var(--status-amber)' : 'var(--status-rose)')};">
                ${curUtil}%
              </span>
            </div>
            <div style="margin: 6px 0 8px 0; background: rgba(0,0,0,0.25); border-radius: 6px; padding: 6px 8px; display: flex; justify-content: center;">
              ${sparkSvgLarge}
            </div>
            <div class="route-graph-subtext">
              Ø: <strong style="color: #fff;">${line.avgUtil60s || curUtil}%</strong> • Min: ${minUtil}% • Max: ${maxUtil}%
            </div>
          </div>

          <!-- Graph Card 2: Ladung vs. Kapazität Cyber Bar -->
          <div class="route-graph-card">
            <div class="route-graph-card-header">
              <span class="route-graph-card-title">📦 ${currentLang === 'de' ? 'Ladung / Kapazität' : 'Load / Capacity'}</span>
              <span class="route-graph-card-badge" style="color: var(--accent-cyan); font-family: var(--font-mono);">
                ${line.load || 0} / ${line.capacity || 0}
              </span>
            </div>
            <div style="margin: 10px 0 12px 0;">
              <div class="load-bar-track" style="height: 12px; background: rgba(255,255,255,0.08); border-radius: 6px; overflow: hidden;">
                <div class="load-bar-fill ${barClass}" style="width: ${Math.min(100, curUtil)}%; height: 100%; border-radius: 6px; transition: width 0.4s ease;"></div>
              </div>
            </div>
            <div class="route-graph-subtext">
              ${Math.max(0, (line.capacity || 0) - (line.load || 0))} ${currentLang === 'de' ? 'freie Plätze' : 'free slots'} • <strong style="color: #fff;">${line.vehicleCount || 0}</strong> ${currentLang === 'de' ? 'Fahrzeuge' : 'units'}
            </div>
          </div>

          <!-- Graph Card 3: Wartende Passagiere / Frachtstau -->
          <div class="route-graph-card">
            <div class="route-graph-card-header">
              <span class="route-graph-card-title">${isPax ? '👥' : '📦'} ${currentLang === 'de' ? 'Wartende Einheiten' : 'Waiting Backlog'}</span>
              <span class="route-graph-card-badge" style="color: ${waitCount > 50 ? 'var(--status-amber)' : (waitCount > 0 ? '#cbd5e1' : 'var(--text-dim)')};">
                ${waitCount} ${unitLabel}
              </span>
            </div>
            <div style="margin: 10px 0 12px 0;">
              <div style="height: 12px; background: rgba(255,255,255,0.08); border-radius: 6px; overflow: hidden;">
                <div style="width: ${Math.min(100, Math.round((waitCount / Math.max(1, line.capacity || 50)) * 100))}%; height: 100%; background: ${waitCount > 50 ? 'var(--status-amber)' : (waitCount > 0 ? '#38bdf8' : 'rgba(255,255,255,0.2)')}; border-radius: 6px;"></div>
              </div>
            </div>
            <div class="route-graph-subtext">
              ${waitCount > 50 ? `⚠️ ${currentLang === 'de' ? 'Hoher Haltestellen-Rückstau' : 'Terminal backlog warning'}` : (waitCount > 0 ? `ℹ️ ${currentLang === 'de' ? 'Puffer im Normalbereich' : 'Normal buffering'}` : `✅ ${currentLang === 'de' ? 'Keine Wartezeiten' : 'Zero wait times'}`)}
            </div>
          </div>

          <!-- Graph Card 4: Cashflow & Perioden-Saldo -->
          <div class="route-graph-card">
            <div class="route-graph-card-header">
              <span class="route-graph-card-title">💰 ${currentLang === 'de' ? 'Ertrag & Saldo' : 'Earnings & Cashflow'}</span>
              <span class="route-graph-card-badge" style="color: ${curCash >= 0 ? 'var(--status-emerald)' : 'var(--status-rose)'};">
                ${formatMoney(curCash, true)}${cashUnit}
              </span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 6px 0; font-family: var(--font-mono); font-size: 0.76rem;">
              <div style="background: rgba(255,255,255,0.03); padding: 4px 6px; border-radius: 4px;">
                <span style="color: var(--text-dim); font-size: 0.68rem;">Ø Jahr:</span> <strong style="color: ${cashYear >= 0 ? '#6ee7b7' : '#fca5a5'};">${formatMoney(cashYear, true)}</strong>
              </div>
              <div style="background: rgba(255,255,255,0.03); padding: 4px 6px; border-radius: 4px;">
                <span style="color: var(--text-dim); font-size: 0.68rem;">Ø Monat:</span> <strong style="color: ${cashMonth >= 0 ? '#6ee7b7' : '#fca5a5'};">${formatMoney(cashMonth, true)}</strong>
              </div>
            </div>
            <div class="route-graph-subtext">
              Live: <strong style="color: #fff;">${formatMoney(line.cashflow60s || 0, true)}/m</strong> • Takt: ${formatFreq(line.frequency)}
            </div>
          </div>

        </div>

        <!-- High-Resolution Route Telemetry Time-Series Chart Box -->
        <div class="route-chart-box">
          <div class="route-chart-toolbar">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.25rem;">📊</span>
                <strong style="font-size: 1rem; color: #fff;">${currentLang === 'de' ? 'Live-Telemetriekurve & Zeitverlauf' : 'Route Telemetry Time-Series'}</strong>
              </div>
              <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">
                ${currentLang === 'de' ? 'Geplottet über Ingame-Datum & Zeitverlauf dieser Linie' : 'Plotted over in-game calendar date & route time-series'}
              </div>
            </div>

            <!-- Metric Selector Pills -->
            <div class="route-chart-pills">
              <button class="route-chart-pill ${inspectorMetric === 'util' ? 'active' : ''}" id="btnMetricUtil" onclick="window.dashboard.setInspectorMetric('util')">📊 ${currentLang === 'de' ? 'Auslastung' : 'Utilization'}</button>
              <button class="route-chart-pill ${inspectorMetric === 'load' ? 'active' : ''}" id="btnMetricLoad" onclick="window.dashboard.setInspectorMetric('load')">📦 ${currentLang === 'de' ? 'Ladung / Kapazität' : 'Load / Cap'}</button>
              <button class="route-chart-pill ${inspectorMetric === 'cashflow' ? 'active' : ''}" id="btnMetricCash" onclick="window.dashboard.setInspectorMetric('cashflow')">💰 ${currentLang === 'de' ? 'Cashflow' : 'Cashflow'}</button>
              <button class="route-chart-pill ${inspectorMetric === 'waiting' ? 'active' : ''}" id="btnMetricWait" onclick="window.dashboard.setInspectorMetric('waiting')">👥 ${currentLang === 'de' ? 'Wartende' : 'Waiting'}</button>
              <button class="route-chart-pill ${inspectorMetric === 'speed' ? 'active' : ''}" id="btnMetricSpeed" onclick="window.dashboard.setInspectorMetric('speed')">⚡ ${currentLang === 'de' ? 'Speed' : 'Speed'}</button>
            </div>

            <!-- Time Horizon Pills -->
            <div class="route-chart-pills">
              <button class="route-chart-pill ${inspectorHorizon === '1m' ? 'active' : ''}" id="btnInspH1m" onclick="window.dashboard.setInspectorHorizon('1m')">⚡ 1m</button>
              <button class="route-chart-pill ${inspectorHorizon === '5m' ? 'active' : ''}" id="btnInspH5m" onclick="window.dashboard.setInspectorHorizon('5m')">⏱️ 5m</button>
              <button class="route-chart-pill ${inspectorHorizon === '15m' ? 'active' : ''}" id="btnInspH15m" onclick="window.dashboard.setInspectorHorizon('15m')">⏳ 15m</button>
              <button class="route-chart-pill ${inspectorHorizon === '30m' ? 'active' : ''}" id="btnInspH30m" onclick="window.dashboard.setInspectorHorizon('30m')">📅 30m</button>
              <button class="route-chart-pill ${inspectorHorizon === 'all' ? 'active' : ''}" id="btnInspHall" onclick="window.dashboard.setInspectorHorizon('all')">🌐 ${currentLang === 'de' ? 'Gesamt' : 'All'}</button>
            </div>
          </div>

          <div class="route-chart-canvas-wrapper">
            <canvas id="chartInspectorCanvas"></canvas>
          </div>

          <div class="route-chart-stats-footer">
            <div>${currentLang === 'de' ? 'Aktuell' : 'Current'}: <strong style="color: #fff;" id="statInspectorCur">--</strong></div>
            <div>${currentLang === 'de' ? 'Minimum' : 'Minimum'}: <strong style="color: var(--status-rose);" id="statInspectorMin">--</strong></div>
            <div>${currentLang === 'de' ? 'Maximum' : 'Maximum'}: <strong style="color: var(--status-emerald);" id="statInspectorMax">--</strong></div>
            <div>${currentLang === 'de' ? 'Durchschnitt' : 'Average'}: <strong style="color: var(--accent-cyan);" id="statInspectorAvg">--</strong></div>
          </div>
        </div>

        <!-- Assigned Vehicles Table -->
        <h3 style="font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 10px;">${currentLang === 'de' ? 'Eingesetzte Fahrzeugflotte' : 'Assigned Vehicle Units'}</h3>
        <div style="overflow-x: auto;">
          <table class="telemetry-table" style="font-size: 0.82rem;">
            <thead>
              <tr>
                <th>${currentLang === 'de' ? 'Fahrzeug' : 'Vehicle Name'}</th>
                <th>${currentLang === 'de' ? 'Kapazität' : 'Capacity'}</th>
                <th>${currentLang === 'de' ? 'Aktuelle Ladung' : 'Current Load'}</th>
                <th>${currentLang === 'de' ? 'Zustand %' : 'Condition %'}</th>
                <th>${currentLang === 'de' ? 'Kostenstrafe' : 'Cost Penalty'}</th>
                <th>${currentLang === 'de' ? 'Alter' : 'Age'}</th>
              </tr>
            </thead>
            <tbody>
              ${(line.vehicles || []).map(v => `
                <tr>
                  <td style="font-weight: 600; color: #fff;">${escapeHtml(v.name || `Vehicle #${v.id}`)}</td>
                  <td class="td-mono">${v.capacity || 0}</td>
                  <td class="td-mono" style="font-weight: 700; color: var(--accent-cyan);">${v.load || 0}</td>
                  <td class="td-mono" style="color: ${v.maintState >= 70 ? 'var(--status-emerald)' : 'var(--status-amber)'};">${v.maintState || 100}%</td>
                  <td class="td-mono" style="color: ${v.costPenalty > 0 ? 'var(--status-rose)' : 'var(--text-muted)'};">${v.costPenalty > 0 ? `+${v.costPenalty}%` : '0%'}</td>
                  <td class="td-mono">${formatAge(v.ageYears)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    renderInspectorChart();
  }

  async function fetchRouteHistory(lid) {
    if (!lid) return;
    try {
      const res = await fetch(`/api/line/${lid}/history`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.history)) {
          routeHistoryCache[lid] = json.history;
          renderInspectorChart();
        }
      }
    } catch (e) {
      console.warn('Error fetching line history:', e);
    }
  }

  function renderInspectorChart() {
    const canvas = document.getElementById('chartInspectorCanvas');
    if (!canvas || !window.Chart || !selectedRouteId) return;

    const history = routeHistoryCache[selectedRouteId] || [];
    if (history.length === 0) return;

    const msMap = { '1m': 60000, '5m': 300000, '15m': 900000, '30m': 1800000, 'all': Infinity };
    const maxAge = msMap[inspectorHorizon] || 300000;
    const now = Date.now();
    const pts = maxAge === Infinity ? history : history.filter(p => (now - p.time) <= maxAge);

    if (pts.length === 0) return;

    const labels = pts.map(p => {
      if (p.gameDate) return p.gameDate;
      const d = new Date(p.time);
      return `${d.getMinutes()}:${d.getSeconds().toString().padStart(2, '0')}`;
    });

    let datasets = [];
    let yFormat = (val) => val;
    let statVals = [];

    if (inspectorMetric === 'util') {
      const dataUtil = pts.map(p => p.utilization || 0);
      statVals = dataUtil;
      datasets = [{
        label: currentLang === 'de' ? 'Auslastung (%)' : 'Utilization (%)',
        data: dataUtil,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        fill: true,
        tension: 0.25,
        borderWidth: 2.2,
        pointRadius: pts.length > 50 ? 0 : 2
      }];
      yFormat = (val) => `${val}%`;
    } else if (inspectorMetric === 'load') {
      const dataLoad = pts.map(p => p.load || 0);
      const dataCap = pts.map(p => p.capacity || 0);
      statVals = dataLoad;
      datasets = [
        {
          label: currentLang === 'de' ? 'Ladung' : 'Load',
          data: dataLoad,
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.2)',
          fill: true,
          tension: 0.25,
          borderWidth: 2.2,
          pointRadius: pts.length > 50 ? 0 : 2
        },
        {
          label: currentLang === 'de' ? 'Kapazität' : 'Capacity',
          data: dataCap,
          borderColor: 'rgba(255, 255, 255, 0.35)',
          borderDash: [4, 4],
          fill: false,
          tension: 0,
          borderWidth: 1.5,
          pointRadius: 0
        }
      ];
      yFormat = (val) => `${val}`;
    } else if (inspectorMetric === 'cashflow') {
      const dataCash = pts.map(p => p.cashflow || 0);
      statVals = dataCash;
      datasets = [{
        label: currentLang === 'de' ? 'Cashflow ($/m)' : 'Cashflow ($/m)',
        data: dataCash,
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.15)',
        fill: true,
        tension: 0.25,
        borderWidth: 2.2,
        pointRadius: pts.length > 50 ? 0 : 2
      }];
      yFormat = (val) => formatMoney(val, true) + '/m';
    } else if (inspectorMetric === 'waiting') {
      const dataWait = pts.map(p => p.waiting || 0);
      statVals = dataWait;
      datasets = [{
        label: currentLang === 'de' ? 'Wartende Einheiten' : 'Waiting Units',
        data: dataWait,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        fill: true,
        tension: 0.25,
        borderWidth: 2.2,
        pointRadius: pts.length > 50 ? 0 : 2
      }];
      yFormat = (val) => `${val}`;
    } else if (inspectorMetric === 'speed') {
      const dataSpeed = pts.map(p => p.speed || 0);
      statVals = dataSpeed;
      datasets = [{
        label: currentLang === 'de' ? 'Geschwindigkeit (km/h)' : 'Speed (km/h)',
        data: dataSpeed,
        borderColor: '#a855f7',
        backgroundColor: 'rgba(168, 85, 247, 0.15)',
        fill: true,
        tension: 0.25,
        borderWidth: 2.2,
        pointRadius: pts.length > 50 ? 0 : 2
      }];
      yFormat = (val) => `${val} km/h`;
    }

    // Update Footer Stats
    if (statVals.length > 0) {
      const cur = statVals[statVals.length - 1];
      const min = Math.min(...statVals);
      const max = Math.max(...statVals);
      const avg = Math.round(statVals.reduce((a, b) => a + b, 0) / statVals.length);

      const elCur = document.getElementById('statInspectorCur');
      const elMin = document.getElementById('statInspectorMin');
      const elMax = document.getElementById('statInspectorMax');
      const elAvg = document.getElementById('statInspectorAvg');
      if (elCur) elCur.textContent = yFormat(cur);
      if (elMin) elMin.textContent = yFormat(min);
      if (elMax) elMax.textContent = yFormat(max);
      if (elAvg) elAvg.textContent = yFormat(avg);
    }

    if (chartRouteInspector) {
      chartRouteInspector.data.labels = labels;
      chartRouteInspector.data.datasets = datasets;
      chartRouteInspector.update();
      return;
    }

    const ctx = canvas.getContext('2d');
    chartRouteInspector = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            display: datasets.length > 1,
            labels: { color: '#94a3b8', font: { size: 11 } }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function (c) {
                return `${c.dataset.label}: ${yFormat(c.raw)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#94a3b8',
              font: { size: 10 },
              maxTicksLimit: 8
            }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#94a3b8',
              font: { size: 10 },
              callback: function (val) {
                return yFormat(val);
              }
            }
          }
        }
      }
    });
  }

  function updateCityFilterBar(lines) {
    const bar = document.getElementById('cityFilterBar');
    if (!bar) return;
    const cities = new Set();
    lines.forEach(l => {
      if (l.towns && Array.isArray(l.towns) && l.towns.length > 0) {
        l.towns.forEach(t => { if (t && t.length <= 25) cities.add(t); });
      } else {
        const city = extractCityFromLineName(l.name);
        if (city && city.length <= 16) cities.add(city);
      }
    });

    const cityList = Array.from(cities).sort();
    const currentActive = tableCity;

    bar.innerHTML = `
      <span style="font-size: 0.78rem; font-weight: 700; color: var(--accent-cyan); text-transform: uppercase;">${currentLang === 'de' ? '🏙️ Städte-Korridore:' : '🏙️ Corridor Cities:'}</span>
      <button class="city-pill ${currentActive === 'ALL' ? 'active' : ''}" data-city="ALL" onclick="window.dashboard.setCityFilter('ALL')">${currentLang === 'de' ? 'Alle' : 'All'}</button>
      ${cityList.map(c => `
        <button class="city-pill ${currentActive === c ? 'active' : ''}" data-city="${escapeHtml(c)}" onclick="window.dashboard.setCityFilter('${escapeHtml(c)}')">${escapeHtml(c)}</button>
      `).join('')}
    `;
  }

  function updateRouteDropdowns(lines) {
    const select = document.getElementById('selectInspectorRoute');
    if (!select) return;
    const curVal = select.value || (selectedRouteId ? selectedRouteId.toString() : '');
    select.innerHTML = '<option value="">' + (currentLang === 'de' ? 'Linie zum Untersuchen auswählen...' : 'Select a route to inspect...') + '</option>' +
      lines.map(l => `<option value="${l.id}" ${l.id.toString() === curVal ? 'selected' : ''}>${escapeHtml(l.name)} (${l.carrierCategory || l.carrier})</option>`).join('');
    if (selectedRouteId) select.value = selectedRouteId;
  }

  // --- Public Interface ---
  window.dashboard = {
    setLanguage: function (lang) {
      currentLang = lang;
      localStorage.setItem('tf3_telemetry_lang', lang);

      const btnEn = document.getElementById('btnLangEN');
      const btnDe = document.getElementById('btnLangDE');
      if (btnEn) btnEn.classList.toggle('active', lang === 'en');
      if (btnDe) btnDe.classList.toggle('active', lang === 'de');

      // Update all elements with data-i18n
      const dict = I18N[lang] || I18N.en;
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (dict[key]) el.textContent = dict[key];
      });
      document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        const key = el.dataset.i18nPh;
        if (dict[key]) el.placeholder = dict[key];
      });

      if (latestData) {
        renderTopKPIs(latestData);
        if (activeTab === 'tab-table') renderTableView(latestData);
        else if (activeTab === 'tab-finances') renderFinancesView(latestData);
      }
    },

    setRiskFilter: function (filter) {
      tableRiskFilter = filter;
      document.querySelectorAll('.filter-pill').forEach(b => {
        b.classList.remove('active');
      });
      const map = {
        'ALL': 'filterBtnAll',
        'SWAP': 'filterBtnSwap',
        'DEFICIT': 'filterBtnDeficit',
        'MAINT': 'filterBtnMaint',
        'BACKLOG': 'filterBtnBacklog',
        'GHOST': 'filterBtnGhost'
      };
      const activeBtn = document.getElementById(map[filter]);
      if (activeBtn) activeBtn.classList.add('active');

      if (latestData) renderTableView(latestData);
    },

    filterTopBleeders: function () {
      window.dashboard.switchTab('tab-table');
      window.dashboard.setRiskFilter('DEFICIT');
    },

    setTableCategory: function (cat) {
      tableCategory = cat;
      document.querySelectorAll('.cat-pill').forEach(b => {
        b.classList.toggle('active', b.dataset.cat === cat);
      });
      if (latestData) renderTableView(latestData);
    },

    setCityFilter: function (city) {
      tableCity = city;
      document.querySelectorAll('.city-pill').forEach(b => {
        b.classList.toggle('active', b.dataset.city === city);
      });
      if (latestData) renderTableView(latestData);
    },

    setWarningTypeFilter: function (type) {
      warnTypeFilter = type;
      const bAll = document.getElementById('btnWarnFilterAll');
      const bPax = document.getElementById('btnWarnFilterPax');
      const bCargo = document.getElementById('btnWarnFilterCargo');
      if (bAll) bAll.classList.toggle('active', type === 'ALL');
      if (bPax) bPax.classList.toggle('active', type === 'PAX');
      if (bCargo) bCargo.classList.toggle('active', type === 'CARGO');
      if (latestData) renderCockpitView(latestData);
    },

    setWarningCityFilter: function (city) {
      warnCityFilter = city;
      if (latestData) renderCockpitView(latestData);
    },

    setTableMode: function (mode) {
      tableDisplayMode = mode;
      localStorage.setItem('tf3_table_mode', mode);
      const bYear = document.getElementById('btnTableModeYear');
      const bMonth = document.getElementById('btnTableModeMonth');
      const bDay = document.getElementById('btnTableModeDay');
      const bLive = document.getElementById('btnTableModeLive');
      const bSess = document.getElementById('btnTableModeSession');
      if (bYear) bYear.classList.toggle('active', mode === 'year');
      if (bMonth) bMonth.classList.toggle('active', mode === 'month');
      if (bDay) bDay.classList.toggle('active', mode === 'day');
      if (bLive) bLive.classList.toggle('active', mode === 'live');
      if (bSess) bSess.classList.toggle('active', mode === 'session');
      if (latestData) renderTableView(latestData);
    },

    setGlobalHorizon: function (h) {
      selectedHorizon = h;
      localStorage.setItem('tf3_horizon', h);
      const map = {
        'all': 'horizonBtnAll',
        'year': 'horizonBtnYear',
        'month': 'horizonBtnMonth',
        'week': 'horizonBtnWeek',
        'live': 'horizonBtnLive'
      };
      document.querySelectorAll('.horizon-pill').forEach(b => {
        b.classList.remove('active');
      });
      const activeBtn = document.getElementById(map[h]);
      if (activeBtn) activeBtn.classList.add('active');

      if (latestData) {
        renderTopKPIs(latestData);
        if (activeTab === 'tab-finances') renderFinancesView(latestData);
        if (activeTab === 'tab-dashboard' || activeTab === 'tab-cockpit') renderCockpitView(latestData);
      }
    },

    setGlobalUnit: function (u) {
      selectedUnit = u;
      localStorage.setItem('tf3_unit', u);
      const map = {
        'year': 'unitBtnYear',
        'month': 'unitBtnMonth',
        'day': 'unitBtnDay',
        'min': 'unitBtnMin'
      };
      document.querySelectorAll('.unit-pill').forEach(b => {
        b.classList.remove('active');
      });
      const activeBtn = document.getElementById(map[u]);
      if (activeBtn) activeBtn.classList.add('active');

      if (latestData) {
        renderTopKPIs(latestData);
        if (activeTab === 'tab-finances') renderFinancesView(latestData);
        if (activeTab === 'tab-dashboard' || activeTab === 'tab-cockpit') renderCockpitView(latestData);
      }
    },

    sortTable: function (col) {
      if (tableSortColumn === col) {
        tableSortAsc = !tableSortAsc;
      } else {
        tableSortColumn = col;
        tableSortAsc = false;
      }
      if (latestData) renderTableView(latestData);
    },

    filterTable: function () {
      if (latestData) renderTableView(latestData);
    },

    setWarehouseFilter: function (filter) {
      warehouseFilter = filter;
      document.querySelectorAll('#btnWhFilterAll, #btnWhFilterSmall, #btnWhFilterLarge, #btnWhFilterCargo').forEach(btn => {
        btn.classList.remove('active');
      });
      const activeBtn = document.getElementById(
        filter === 'ALL' ? 'btnWhFilterAll' :
        filter === 'OVERFLOW' ? 'btnWhFilterSmall' :
        filter === 'UNDERUTILIZED' ? 'btnWhFilterLarge' : 'btnWhFilterCargo'
      );
      if (activeBtn) activeBtn.classList.add('active');
      if (latestData) renderWarehouseMonitor(latestData);
    },

    filterWarehouses: function () {
      const input = document.getElementById('warehouseSearchInput');
      warehouseSearchQuery = input ? input.value.trim() : '';
      if (latestData) renderWarehouseMonitor(latestData);
    },

    selectRoute: function (id) {
      if (!id) return;
      selectedRouteId = parseInt(id, 10);
      if (chartRouteInspector) {
        chartRouteInspector.destroy();
        chartRouteInspector = null;
      }
      fetchRouteHistory(selectedRouteId);
      if (latestData) renderRouteInspector(latestData);
    },

    openRouteDetails: function (id) {
      if (!id) return;
      selectedRouteId = parseInt(id, 10);
      if (chartRouteInspector) {
        chartRouteInspector.destroy();
        chartRouteInspector = null;
      }
      fetchRouteHistory(selectedRouteId);
      const sel = document.getElementById('selectInspectorRoute');
      if (sel) sel.value = selectedRouteId.toString();
      const btn = document.querySelector('.tab-btn[data-tab="tab-inspector"]');
      if (btn) btn.click();
    },

    setInspectorMetric: function (metric) {
      inspectorMetric = metric;
      document.querySelectorAll('#btnMetricUtil, #btnMetricLoad, #btnMetricCash, #btnMetricWait, #btnMetricSpeed').forEach(b => {
        b.classList.remove('active');
      });
      const map = {
        'util': 'btnMetricUtil',
        'load': 'btnMetricLoad',
        'cashflow': 'btnMetricCash',
        'waiting': 'btnMetricWait',
        'speed': 'btnMetricSpeed'
      };
      const activeBtn = document.getElementById(map[metric]);
      if (activeBtn) activeBtn.classList.add('active');
      if (chartRouteInspector) {
        chartRouteInspector.destroy();
        chartRouteInspector = null;
      }
      renderInspectorChart();
    },

    setInspectorHorizon: function (h) {
      inspectorHorizon = h;
      document.querySelectorAll('#btnInspH1m, #btnInspH5m, #btnInspH15m, #btnInspH30m, #btnInspHall').forEach(b => {
        b.classList.remove('active');
      });
      const map = {
        '1m': 'btnInspH1m',
        '5m': 'btnInspH5m',
        '15m': 'btnInspH15m',
        '30m': 'btnInspH30m',
        'all': 'btnInspHall'
      };
      const activeBtn = document.getElementById(map[h]);
      if (activeBtn) activeBtn.classList.add('active');
      renderInspectorChart();
    },

    setChartHorizon: function (h) {
      chartHorizon = h;
      document.querySelectorAll('.horizon-pill').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.includes(h));
      });
      if (latestData) renderWallOfCharts(latestData);
    },

    setTreasuryHorizon: function (h, btn) {
      treasuryHorizon = h;
      document.querySelectorAll('#btnTreasury5m, #btnTreasury15m, #btnTreasury30m, #btnTreasury1h').forEach(b => {
        b.classList.remove('active');
      });
      const activeBtn = document.getElementById(h === '5m' ? 'btnTreasury5m' : (h === '15m' ? 'btnTreasury15m' : (h === '30m' ? 'btnTreasury30m' : 'btnTreasury1h')));
      if (activeBtn) activeBtn.classList.add('active');
      else if (btn) btn.classList.add('active');

      renderTreasuryChart();
    },

    resetSession: async function () {
      try {
        showToast(currentLang === 'de' ? '⏳ Setze Session & Saldo zurück...' : '⏳ Resetting session statistics...');
        const res = await fetch('/api/reset', { method: 'POST' });
        const json = await res.json();
        showToast('✅ ' + (json.message || 'Session reset successful!'));
        const liveRes = await fetch('/api/live');
        if (liveRes.ok) {
          const d = await liveRes.json();
          handleTelemetryTick(d);
        }
      } catch (e) {
        showToast('❌ Error resetting: ' + e.message, 'error');
      }
    },

    switchTab: function (tabId) {
      const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
      if (btn) btn.click();
    },

    handleAdvisoryAction: function (type) {
      if (type === 'DEFICIT_LINES') {
        window.dashboard.switchTab('tab-table');
        window.dashboard.setRiskFilter('DEFICIT');
      } else if (type === 'FLEET_MAINTENANCE') {
        window.dashboard.switchTab('tab-table');
        window.dashboard.setRiskFilter('MAINT');
      }
    },

    openDateCalibration: function () {
      const modal = document.getElementById('dateCalibModal');
      if (modal) modal.classList.add('open');
    },

    closeDateCalibration: function () {
      const modal = document.getElementById('dateCalibModal');
      if (modal) modal.classList.remove('open');
    },

    syncGameDate: async function () {
      const input = document.getElementById('inputCalibDate');
      const selectSpeed = document.getElementById('selectCalibSpeed');
      const msg = document.getElementById('dateCalibSuccessMsg');
      const msgText = document.getElementById('dateCalibSuccessText');

      const anchorDate = input ? input.value.trim() : '1984-06-15';
      const speedFactor = selectSpeed ? parseFloat(selectSpeed.value) : 1.0;
      const isPaused = speedFactor === 0.0;

      try {
        const res = await fetch('/api/calibration/date', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ anchorDate, speedFactor, isPaused, syncWithCurrentTime: true })
        });
        const json = await res.json();
        if (json.success) {
          const headerDate = document.getElementById('headerGameDate');
          if (headerDate && json.currentDate) headerDate.textContent = json.currentDate;
          if (msg) {
            msg.style.display = 'flex';
            if (msgText) msgText.textContent = `✓ ${json.currentDate || anchorDate}`;
            setTimeout(() => { msg.style.display = 'none'; }, 3000);
          }
        }
      } catch (e) {
        alert('Date sync error: ' + e.message);
      }
    },

    openQrModal: function () {
      const modal = document.getElementById('qrModalBackdrop');
      if (modal) modal.classList.add('open');
    },

    closeQrModal: function (e, force) {
      if (force || (e && e.target.id === 'qrModalBackdrop')) {
        const modal = document.getElementById('qrModalBackdrop');
        if (modal) modal.classList.remove('open');
      }
    },

    openFleetAdvisorModal: function () {
      const modal = document.getElementById('fleetAdvisorModal');
      if (modal) {
        modal.style.display = 'flex';
        renderFleetAdvisorList();
      }
    },

    closeFleetAdvisorModal: function () {
      const modal = document.getElementById('fleetAdvisorModal');
      if (modal) modal.style.display = 'none';
    },

    setAdvisorModalTab: function (tab) {
      advisorModalTab = tab;
      document.querySelectorAll('.cyber-modal-tabs .modal-tab-btn').forEach(btn => btn.classList.remove('active'));
      const activeBtn = document.getElementById(tab === 'ALL' ? 'modalTabAll' : (tab === 'PAX' ? 'modalTabPax' : 'modalTabCargo'));
      if (activeBtn) activeBtn.classList.add('active');
      renderFleetAdvisorList();
    },

    openVehicleAdviceModal: function (lineId) {
      if (!latestData || !latestData.lines) return;
      const line = latestData.lines.find(l => l.id === lineId);
      if (!line || !line.vehicleAdvice) return;
      window.dashboard.openFleetAdvisorModal();
      setTimeout(() => {
        const card = document.getElementById(`advCard-${lineId}`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.style.borderColor = 'var(--accent-cyan)';
          card.style.boxShadow = '0 0 25px rgba(6, 182, 212, 0.5)';
        }
      }, 100);
    }
  };

  let advisorModalTab = 'ALL';

  // Pair over-capacity lines (REMOVE) with lines that need vehicles (ADD/UPGRADE)
  // Only same carrier (road/rail/...) and same Pax/Cargo type; for cargo, same goods preferred.
  function computeLineTransfers(allLines) {
    const donors = [];
    const receivers = [];
    allLines.forEach(l => {
      const va = l.vehicleAdvice;
      if (!va) return;
      const vCnt = l.vehicleCount || va.currentCount || 0;
      if (va.action === 'REMOVE' && vCnt > 1) {
        donors.push({ line: l, spare: Math.max(1, (va.currentCount || 0) - (va.recommendedCount || 0)) });
      } else if (va.action === 'ADD' || va.action === 'UPGRADE') {
        receivers.push({ line: l, need: Math.max(1, va.unitDifference || 1) });
      } else if ((l.totalWaiting || 0) >= 50 || (l.avgUtil60s || 0) >= 85) {
        receivers.push({ line: l, need: (l.totalWaiting || 0) >= 150 ? 2 : 1 });
      } else if (vCnt >= 2 && (l.avgUtil60s || 0) < 35 && (l.totalWaiting || 0) < 20) {
        donors.push({ line: l, spare: 1 });
      }
    });
    donors.sort((a, b) => (a.line.avgUtil60s || 0) - (b.line.avgUtil60s || 0));
    receivers.sort((a, b) => (b.line.totalWaiting || 0) - (a.line.totalWaiting || 0));

    const transfers = [];
    receivers.forEach(r => {
      const rva = r.line.vehicleAdvice;
      const compatible = donors.filter(d => d.spare > 0 &&
        d.line.vehicleAdvice.isPax === rva.isPax &&
        d.line.vehicleAdvice.carrierCategory === rva.carrierCategory);
      // Prefer same city, then same cargo goods, then same vehicle model
      const rTowns = r.line.towns || [];
      const score = (d) => {
        const dva = d.line.vehicleAdvice;
        const sameCity = (d.line.towns || []).some(t => rTowns.includes(t)) ? 4 : 0;
        return sameCity + (dva.cargoType === rva.cargoType ? 2 : 0) + (dva.currentShort === rva.currentShort ? 1 : 0);
      };
      compatible.sort((a, b) => score(b) - score(a));
      for (const d of compatible) {
        if (r.need <= 0) break;
        // Cargo vehicles usually can't carry different goods -> require same goods for cargo
        if (!rva.isPax && d.line.vehicleAdvice.cargoType !== rva.cargoType) continue;
        const n = Math.min(d.spare, r.need);
        d.spare -= n;
        r.need -= n;
        transfers.push({ from: d.line, to: r.line, count: n, isPax: rva.isPax,
          sameCity: (d.line.towns || []).some(t => rTowns.includes(t)) });
      }
    });
    transfers.sort((a, b) => (b.sameCity ? 1 : 0) - (a.sameCity ? 1 : 0));
    return transfers;
  }

  function renderTransferCards(transfers, withPerLineTitle = true) {
    if (transfers.length === 0) return '';
    const de = currentLang === 'de';
    return `
      <div class="advisor-section-title">🔁 ${de ? 'Fahrzeuge umverteilen (Linie ➔ Linie)' : 'Reassign vehicles (line ➔ line)'}</div>
      ${transfers.map(t => {
        const fva = t.from.vehicleAdvice;
        const townsOf = (l) => (l.towns && l.towns.length) ? l.towns.join(' ➔ ') : (de ? 'Stadt unbekannt' : 'unknown city');
        return `
        <div class="transfer-card">
          <div class="transfer-side">
            <div class="transfer-label">${de ? 'Von' : 'From'}</div>
            <div class="transfer-name" onclick="window.dashboard.closeFleetAdvisorModal(); window.dashboard.openRouteDetails(${t.from.id})">${escapeHtml(t.from.name)}</div>
            <div class="transfer-city">📍 ${escapeHtml(townsOf(t.from))}</div>
            <div class="transfer-meta">${t.from.avgUtil60s || 0}% ${de ? 'Auslastung' : 'util'} • ${t.from.vehicleCount || 0} ${de ? 'Fzg' : 'units'}</div>
          </div>
          <div class="transfer-arrow">
            <strong>➔</strong>
            ${t.count}× ${escapeHtml(fva.currentShort || fva.currentModel || '')}
            <div class="transfer-scope">${t.sameCity ? (de ? 'gleiche Stadt' : 'same city') : (de ? 'andere Stadt' : 'other city')}</div>
          </div>
          <div class="transfer-side">
            <div class="transfer-label">${de ? 'Nach' : 'To'}</div>
            <div class="transfer-name" onclick="window.dashboard.closeFleetAdvisorModal(); window.dashboard.openRouteDetails(${t.to.id})">${escapeHtml(t.to.name)}</div>
            <div class="transfer-city">📍 ${escapeHtml(townsOf(t.to))}</div>
            <div class="transfer-meta">${t.to.totalWaiting || 0} ${de ? 'wartend' : 'waiting'} • ${t.isPax ? (de ? 'Passagiere' : 'Passengers') : escapeHtml(t.to.cargoType || (de ? 'Fracht' : 'Cargo'))}</div>
          </div>
        </div>`;
      }).join('')}
      ${withPerLineTitle ? `<div class="advisor-section-title" style="margin-top: 10px;">🚗 ${de ? 'Einzelempfehlungen je Linie' : 'Per-line recommendations'}</div>` : ''}
    `;
  }

  function renderFleetAdvisorList() {
    const container = document.getElementById('fleetAdvisorList');
    if (!container || !latestData || !latestData.lines) return;

    let transfers = computeLineTransfers(latestData.lines);
    if (advisorModalTab === 'PAX') transfers = transfers.filter(t => t.isPax);
    else if (advisorModalTab === 'CARGO') transfers = transfers.filter(t => !t.isPax);
    const transferHtml = renderTransferCards(transfers);

    let lines = latestData.lines.filter(l => l.vehicleAdvice && (l.vehicleAdvice.action === 'SWAP' || l.vehicleAdvice.action === 'UPGRADE' || l.vehicleAdvice.action === 'ADD' || l.vehicleAdvice.action === 'REMOVE'));

    if (advisorModalTab === 'PAX') {
      lines = lines.filter(l => l.vehicleAdvice.isPax);
    } else if (advisorModalTab === 'CARGO') {
      lines = lines.filter(l => !l.vehicleAdvice.isPax);
    }

    if (lines.length === 0) {
      container.innerHTML = transferHtml + `<div style="text-align: center; padding: 40px; color: var(--text-dim);">${currentLang === 'de' ? 'Keine Fahrzeugwechsel für diesen Filter nötig. Alle Flotten optimal!' : 'No vehicle replacements needed for this category. All fleets operating optimally!'}</div>`;
      return;
    }

    container.innerHTML = transferHtml + lines.map(l => {
      const va = l.vehicleAdvice;
      const isPax = va.isPax;
      const typeBadge = isPax
        ? `<span class="carrier-tag tag-pax">🚌 ${currentLang === 'de' ? 'PASSAGIERE / ÖPNV' : 'PASSENGER / TRANSIT'}</span>`
        : `<span class="carrier-tag tag-cargo">🚚 ${currentLang === 'de' ? 'GÜTERVERKEHR / FRACHT' : 'FREIGHT / CARGO'}</span>`;

      let actionBadge = `<span class="va-chip va-swap">🔄 ${currentLang === 'de' ? 'FLOTTENTAUSCH' : 'FLEET SWAP'}</span>`;
      if (va.action === 'UPGRADE') {
        actionBadge = `<span class="va-chip va-upgrade">⬆️ ${currentLang === 'de' ? 'KAPAZITÄTS-UPGRADE' : 'CAPACITY UPGRADE'}</span>`;
      } else if (va.action === 'ADD') {
        actionBadge = `<span class="va-chip va-add">➕ ${currentLang === 'de' ? 'FAHRZEUG ZUFÜGEN' : 'ADD UNIT'}</span>`;
      } else if (va.action === 'REMOVE') {
        actionBadge = `<span class="va-chip va-remove">➖ ${currentLang === 'de' ? 'FAHRZEUG ABZIEHEN' : 'WITHDRAW UNIT'}</span>`;
      }

      const reasonText = currentLang === 'de' ? va.reason : va.reasonEn;
      const savingsStr = va.potentialSavingsYear > 0 ? (currentLang === 'de' ? `💰 Ersparnis: ca. ${formatMoney(va.potentialSavingsYear)}/Jahr` : `💰 Savings: ~${formatMoney(va.potentialSavingsYear)}/yr`) : '';

      return `
        <div class="advisor-card" id="advCard-${l.id}">
          <div class="advisor-card-header">
            <div>
              <strong style="color: #fff; font-size: 1rem;">${escapeHtml(l.name)}</strong>
              ${(l.towns && l.towns.length) ? `<div class="transfer-city">📍 ${escapeHtml(l.towns.join(' ➔ '))}</div>` : ''}
              <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">
                ${l.cargoType ? `📦 ${escapeHtml(l.cargoType)}` : ''} • ID: ${l.id}
              </div>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              ${typeBadge}
              ${actionBadge}
            </div>
          </div>

          <div class="advisor-flow">
            <!-- CURRENT VEHICLE -->
            <div class="advisor-flow-box">
              <div style="font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700; margin-bottom: 2px;">
                ${currentLang === 'de' ? 'Aktuelle Flotte' : 'Current Fleet'}
              </div>
              <div style="color: #cbd5e1; font-weight: 600; font-size: 0.9rem;">
                ${va.currentCount}x ${escapeHtml(va.currentModel || va.currentShort)}
              </div>
              <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">
                ${l.avgAgeYears ? `Ø ${formatAge(l.avgAgeYears)}` : ''} ${(l.costPenalty || 0) > 0 ? `<span style="color: var(--status-rose);">(+${l.costPenalty}% ${currentLang === 'de' ? 'Strafe' : 'penalty'})</span>` : ''}
              </div>
            </div>

            <!-- ARROW -->
            <div class="advisor-flow-arrow">➔</div>

            <!-- TARGET VEHICLE -->
            <div class="advisor-flow-box">
              <div style="font-size: 0.72rem; color: var(--accent-cyan); text-transform: uppercase; font-weight: 700; margin-bottom: 2px;">
                ${currentLang === 'de' ? 'Empfohlenes Zielfahrzeug' : 'Target Vehicle Upgrade'}
              </div>
              <div style="color: #38bdf8; font-weight: 700; font-size: 0.9rem;">
                ${va.recommendedCount}x ${escapeHtml(va.targetModel || va.targetShort)}
              </div>
              <div style="font-size: 0.76rem; color: var(--status-emerald); margin-top: 2px;">
                ${currentLang === 'de' ? '0% Strafaufschlag • Hohe Effizienz' : '0% Maintenance Penalty • High Efficiency'}
              </div>
            </div>
          </div>

          <div style="font-size: 0.82rem; color: #e2e8f0; line-height: 1.4; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 6px;">
            💡 <strong>${currentLang === 'de' ? 'Analyse & Wirkung:' : 'Strategic Impact:'}</strong> ${escapeHtml(reasonText)}
            ${savingsStr ? `<div style="margin-top: 4px; color: var(--status-emerald); font-weight: 600;">${savingsStr}</div>` : ''}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px; font-size: 0.75rem; color: var(--text-muted);">
            <span>🎮 <em>${currentLang === 'de' ? 'TF3 Schritt: Linie auswählen ➔ Fahrzeuge verwalten ➔ Fahrzeuge ersetzen' : 'TF3 Step: Select Route ➔ Manage Fleet ➔ Replace Vehicles'}</em></span>
            <button class="btn btn-sm btn-outline" onclick="window.dashboard.closeFleetAdvisorModal(); window.dashboard.openRouteDetails(${l.id})">
              ${currentLang === 'de' ? 'Linie öffnen ➔' : 'Inspect Route ➔'}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // --- DOM Setup ---
  document.addEventListener('DOMContentLoaded', function () {
    // 1. Language Setup
    window.dashboard.setLanguage(currentLang);

    // 1b. Horizon & Unit & Table Mode Setup
    window.dashboard.setGlobalHorizon(selectedHorizon);
    window.dashboard.setGlobalUnit(selectedUnit);
    window.dashboard.setTableMode(tableDisplayMode);

    // 2. Tab Navigation
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        activeTab = btn.dataset.tab;
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById(activeTab);
        if (panel) panel.classList.add('active');

        if (latestData) {
          if (activeTab === 'tab-dashboard' || activeTab === 'tab-cockpit') renderCockpitView(latestData);
          else if (activeTab === 'tab-table') renderTableView(latestData);
          else if (activeTab === 'tab-finances') renderFinancesView(latestData);
          else if (activeTab === 'tab-wall-charts') renderWallOfCharts(latestData);
          else if (activeTab === 'tab-patterns') renderPatternsAndForecasting(latestData);
          else if (activeTab === 'tab-inspector') renderRouteInspector(latestData);
        }
      });
    });

    async function fetchInitialData() {
      try {
        const res = await fetch('/api/live');
        if (res.ok) {
          const data = await res.json();
          handleTelemetryTick(data);
        }
      } catch (e) {
        console.warn('Initial telemetry fetch:', e);
      }
    }

    initWebSocket();
    fetchInitialData();
  });

})();
