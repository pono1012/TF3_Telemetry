const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (ws) => {
  if (latestPayload) {
    ws.send(JSON.stringify({
      type: 'TELEMETRY_UPDATE',
      data: latestPayload,
      server: {
        lanIp: LAN_IP,
        port: PORT,
        tabletUrl: TABLET_URL,
        qrCode: qrCodeDataUrl,
        isLive: Date.now() - lastIngestTime < 6000
      }
    }));
  }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

const PROJECT_DIR = __dirname;
const LIVE_JSON_PATH = path.join(PROJECT_DIR, 'live_telemetry.json');

function resolveStdoutPath() {
  if (process.env.TF3_STDOUT_PATH && fs.existsSync(process.env.TF3_STDOUT_PATH)) {
    return process.env.TF3_STDOUT_PATH;
  }

  const appData = process.env.APPDATA || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Roaming') : '');
  const userDocs = process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Documents') : '';
  const candidates = [];

  // 1. Dynamic GSE Saves discovery (any user / app ID)
  if (appData) {
    const gseDir = path.join(appData, 'GSE Saves');
    if (fs.existsSync(gseDir)) {
      try {
        const subdirs = fs.readdirSync(gseDir);
        for (const sub of subdirs) {
          candidates.push(path.join(gseDir, sub, 'local', 'crash_dump', 'stdout.txt'));
        }
      } catch (e) {}
    }
    candidates.push(path.join(appData, 'Transport Fever 3', 'crash_dump', 'stdout.txt'));
    candidates.push(path.join(appData, 'Transport Fever 2', 'crash_dump', 'stdout.txt'));
  }

  // 2. Steam userdata locations
  for (const drive of ['C:', 'D:', 'E:']) {
    const sDir = `${drive}\\Program Files (x86)\\Steam\\userdata`;
    if (fs.existsSync(sDir)) {
      try {
        for (const u of fs.readdirSync(sDir)) {
          candidates.push(path.join(sDir, u, '1066780', 'local', 'crash_dump', 'stdout.txt'));
        }
      } catch (e) {}
    }
  }

  // 3. User documents
  if (userDocs) {
    candidates.push(path.join(userDocs, 'Urban Games', 'Transport Fever 2', 'crash_dump', 'stdout.txt'));
    candidates.push(path.join(userDocs, 'Urban Games', 'Transport Fever 3', 'crash_dump', 'stdout.txt'));
  }

  // 4. Fallback to local project directory
  candidates.push(path.join(PROJECT_DIR, 'stdout.txt'));

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0] || path.join(PROJECT_DIR, 'stdout.txt');
}

const STDOUT_PATH = resolveStdoutPath();

function getLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.') || iface.address.startsWith('172.')) {
          return iface.address;
        }
      }
    }
  }
  return 'localhost';
}

const LAN_IP = getLanIp();
const TABLET_URL = `http://${LAN_IP}:${PORT}`;

let qrCodeDataUrl = '';
QRCode.toDataURL(TABLET_URL, { margin: 1, color: { dark: '#06b6d4', light: '#0f172a' } })
  .then(url => { qrCodeDataUrl = url; })
  .catch(() => {});

// Classification Rules: Pure engine carrier & isOpnv first
function classifyLine(lineName, vehicles, engineCarrier, isOpnv) {
  if (engineCarrier === 'ROAD_CARGO') return 'ROAD_CARGO';
  if (isOpnv === false && engineCarrier) return engineCarrier;

  const nl = (lineName || '').trim().toUpperCase();
  const nameLooksLikeOpnv = (nl.includes('BUS') || nl.includes('TRAM') || nl.includes('PASSENGER') || (nl.includes('ÖPNV') && !nl.includes('CARGO') && !nl.includes('FLEISCH') && !nl.includes('OIL') && !nl.includes('GRAIN')));

  // If marked as passenger/ÖPNV either by engine or by name:
  if (isOpnv || nameLooksLikeOpnv) {
    if (engineCarrier === 'RAIL' || nl.includes('ZUG') || nl.includes('TRAIN') || nl.includes('BAHN') || nl.includes('RAIL')) return 'RAIL';
    if (engineCarrier === 'WATER' || nl.includes('SCHIFF') || nl.includes('BOOT') || nl.includes('SHIP') || nl.includes('FERRY')) return 'WATER';
    if (engineCarrier === 'AIR' || nl.includes('FLUG') || nl.includes('PLANE') || nl.includes('AIR') || nl.includes('HELI')) return 'AIR';
    return 'ROAD_PERSON';
  }

  // 1. Direct Engine Carrier from game components
  if (engineCarrier && ['ROAD_CARGO', 'ROAD_PERSON', 'RAIL', 'WATER', 'AIR'].includes(engineCarrier)) {
    return engineCarrier;
  }

  // 2. Vehicle names
  const vNames = (vehicles || []).map(v => (v.name || '').toLowerCase()).join(' ');
  if (vNames.includes('ship') || vNames.includes('boot') || vNames.includes('schiff')) return 'WATER';
  if (vNames.includes('train') || vNames.includes('zug') || vNames.includes('lok')) return 'RAIL';
  if (vNames.includes('plane') || vNames.includes('heli') || vNames.includes('aircraft')) return 'AIR';

  // 3. User naming keywords
  if (nl.includes('ZUG') || nl.includes('TRAIN') || nl.includes('BAHN') || nl.includes('RAIL')) return 'RAIL';
  if (nl.includes('SCHIFF') || nl.includes('BOOT') || nl.includes('SHIP') || nl.includes('WATER') || nl.includes('FERRY')) return 'WATER';
  if (nl.includes('FLUG') || nl.includes('PLANE') || nl.includes('AIR') || nl.includes('HELI')) return 'AIR';
  if (nl.includes('CARGO') || nl.includes('GÜTER') || nl.includes('LKW')) return 'ROAD_CARGO';

  return 'ROAD_CARGO';
}

// --- In-Game Calendar Calibration System ---
const DATE_CONFIG_PATH = path.join(PROJECT_DIR, 'date_config.json');
const MONTH_NAMES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
let dateConfig = {
  anchorDate: '2008-10-05',
  anchorGameTime: 159613200,
  speedFactor: 1.0,
  isPaused: false
};

function loadDateConfig() {
  if (fs.existsSync(DATE_CONFIG_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DATE_CONFIG_PATH, 'utf8'));
      dateConfig = Object.assign(dateConfig, parsed);
    } catch (e) {
      console.warn('[TF3 Dashboard] Warning loading date_config.json:', e.message);
    }
  }
}
loadDateConfig();

function saveDateConfig() {
  try {
    fs.writeFileSync(DATE_CONFIG_PATH, JSON.stringify(dateConfig, null, 2), 'utf8');
  } catch (e) {
    console.error('[TF3 Dashboard] Error saving date_config.json:', e.message);
  }
}

function parseCustomDate(input) {
  if (!input) return new Date(Date.UTC(2008, 9, 5));
  // Check if string like "Oct 5, 2008" or "Oct 05, 2008"
  const mMatch = input.match(/^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (mMatch) {
    const mStr = mMatch[1].toLowerCase();
    const monthMap = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const mIndex = monthMap[mStr] !== undefined ? monthMap[mStr] : 9;
    const dVal = parseInt(mMatch[2], 10);
    const yVal = parseInt(mMatch[3], 10);
    return new Date(Date.UTC(yVal, mIndex, dVal));
  }
  const parsed = new Date(input);
  if (!isNaN(parsed.getTime())) return parsed;
  return new Date(Date.UTC(2008, 9, 5));
}

function formatGameCalendarDate(gameTime, gameDateRaw) {
  // If the mod provided a real formatted calendar date (e.g. "05.10.2008" or "Oct 5, 2008")
  if (gameDateRaw && !gameDateRaw.match(/^\d+h\s*\d+m$/) && gameDateRaw.trim() !== '') {
    return gameDateRaw;
  }

  const baseDate = parseCustomDate(dateConfig.anchorDate);
  if (dateConfig.isPaused || dateConfig.speedFactor === 0) {
    const day = baseDate.getUTCDate();
    const month = baseDate.getUTCMonth();
    const year = baseDate.getUTCFullYear();
    const monthName = MONTH_NAMES_EN[month] || 'Oct';
    return `${monthName} ${day}, ${year}`;
  }

  const anchorTime = (typeof dateConfig.anchorGameTime === 'number' && dateConfig.anchorGameTime > 0)
    ? dateConfig.anchorGameTime
    : (gameTime || 159613200);

  const msDiff = (typeof gameTime === 'number' && gameTime > 0) ? (gameTime - anchorTime) : 0;
  const speed = (typeof dateConfig.speedFactor === 'number' && dateConfig.speedFactor > 0) ? dateConfig.speedFactor : 1.0;
  const msPerDay = 2000 / speed;
  const daysDiff = msDiff / msPerDay;

  const currentD = new Date(baseDate.getTime() + daysDiff * 86400000);
  const day = currentD.getUTCDate();
  const month = currentD.getUTCMonth();
  const year = currentD.getUTCFullYear();
  const monthName = MONTH_NAMES_EN[month] || 'Oct';

  return `${monthName} ${day}, ${year}`;
}

function parseGameDateToDays(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.trim().split('.');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return (year * 365) + ((month - 1) * 30.4166) + day;
    }
  }
  const mMatch = dateStr.match(/^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (mMatch) {
    const monthMap = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const m = monthMap[mMatch[1].toLowerCase()] || 0;
    const d = parseInt(mMatch[2], 10);
    const y = parseInt(mMatch[3], 10);
    return (y * 365) + (m * 30.4166) + d;
  }
  return null;
}



// Session in-memory state & sliding windows
// Session in-memory state & persistent disk storage
let sessionStartTime = Date.now();
const HISTORY_MAX_POINTS = 3600; // Up to 120 minutes at 2s interval
const HISTORY_FILE = path.join(PROJECT_DIR, 'telemetry_history.json');

const lineHistory = {}; // lineId -> array of history records
const line60sBuffer = {}; // lineId -> array of records in last 60s
const sessionCumulative = {}; // lineId -> cumulative stats
const networkHistory = []; // time-series of overall company network performance
const treasuryHistory = []; // time-series of player bank balance [{ time, balance }]
let lastCompanyFinances = null;
let lastCompanyStats = null;

// Persistent History Recovery from Disk
function loadPersistentHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const content = fs.readFileSync(HISTORY_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.treasuryHistory)) {
        const valid = parsed.treasuryHistory.filter(p => p && typeof p.balance === 'number' && typeof p.time === 'number');
        treasuryHistory.push(...valid);
        console.log(`[TF3 Dashboard] Restored ${treasuryHistory.length} persistent treasury points from ${HISTORY_FILE}`);
      }
      if (Array.isArray(parsed.networkHistory)) {
        networkHistory.push(...parsed.networkHistory.filter(p => p && typeof p.time === 'number'));
      }
    }
  } catch (e) {
    console.warn('[TF3 Dashboard] Warning reading telemetry_history.json:', e.message);
  }
}
loadPersistentHistory();

let lastHistoryDiskSave = 0;
function persistHistoryToDisk(force = false) {
  const now = Date.now();
  if (!force && (now - lastHistoryDiskSave < 8000)) return; // Debounce 8s
  lastHistoryDiskSave = now;
  try {
    const toSave = {
      savedAt: now,
      savedAtIso: new Date(now).toISOString(),
      treasuryCount: treasuryHistory.length,
      treasuryHistory: treasuryHistory.slice(-3600),
      networkHistory: networkHistory.slice(-600)
    };
    fs.writeFile(HISTORY_FILE, JSON.stringify(toSave), () => {});
  } catch (e) {
    // Non-fatal
  }
}

let latestPayload = null;
let lastIngestTime = 0;
let processRunning = false;

// Simulation Pause & Speed Multiplier Tracking
let lastSeenGameTime = 0;
let lastSeenGameTimeChangeTs = Date.now();
let lastRealTickTs = Date.now();
let currentSimState = 'RUNNING'; // 'RUNNING', 'PAUSED'
let currentSimSpeed = 1.0;

function resetSession() {
  sessionStartTime = Date.now();
  networkHistory.length = 0;
  treasuryHistory.length = 0;
  for (const lid of Object.keys(lineHistory)) {
    delete lineHistory[lid];
    delete line60sBuffer[lid];
    delete sessionCumulative[lid];
  }
  persistHistoryToDisk(true);

  // Force re-ingest newest data from disk immediately
  ingestTelemetry();

  if (latestPayload && latestPayload.lines) {
    for (const l of latestPayload.lines) {
      l.cashflow = 0;
      l.balance = 0;
    }
    processTelemetryTick(latestPayload);
  }

  broadcast({
    type: 'SESSION_RESET',
    message: 'Session-Saldo und Durchschnitte erfolgreich zurückgesetzt'
  });
  console.log('[TF3 Dashboard] Session reset completed & broadcasted.');
}

const stationHistory = {};
let lastRawStdoutStr = '';
let lastLoadedJsonMtime = 0;

function ingestTelemetry() {
  try {
    let rawJsonStr = null;

    if (fs.existsSync(STDOUT_PATH)) {
      const stats = fs.statSync(STDOUT_PATH);
      const readSize = Math.min(500000, stats.size);
      const buf = Buffer.alloc(readSize);
      const fd = fs.openSync(STDOUT_PATH, 'r');
      fs.readSync(fd, buf, 0, readSize, Math.max(0, stats.size - readSize));
      fs.closeSync(fd);
      const content = buf.toString('utf-8');
      const matches = [...content.matchAll(/\[TF3_LIVE_TELEMETRY\](.*)/g)];
      if (matches.length > 0) {
        const latestFromStdout = matches[matches.length - 1][1].trim();
        if (latestFromStdout !== lastRawStdoutStr) {
          lastRawStdoutStr = latestFromStdout;
          rawJsonStr = latestFromStdout;
          fs.writeFile(LIVE_JSON_PATH, rawJsonStr, () => {});
        }
      }
    }

    if (!rawJsonStr && fs.existsSync(LIVE_JSON_PATH)) {
      const stat = fs.statSync(LIVE_JSON_PATH);
      if (!latestPayload || stat.mtimeMs > lastLoadedJsonMtime) {
        rawJsonStr = fs.readFileSync(LIVE_JSON_PATH, 'utf-8');
        lastLoadedJsonMtime = stat.mtimeMs;
      }
    }

    if (rawJsonStr) {
      let data = null;
      try {
        data = JSON.parse(rawJsonStr);
      } catch (parseErr) {
        const firstBrace = rawJsonStr.indexOf('{');
        const lastBrace = rawJsonStr.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          try {
            data = JSON.parse(rawJsonStr.slice(firstBrace, lastBrace + 1));
          } catch (_) {}
        }
      }
      if (data) {
        processTelemetryTick(data);
      }
    }
  } catch (err) {
    // Silently ignore transient in-flight file read collisions
  }
}

function computeWindowAverage(history, windowMs, now) {
  if (!history || history.length === 0) {
    return { load: 0, util: 0, cashflow: 0, speed: 0, samples: 0 };
  }
  let sumLoad = 0;
  let sumUtil = 0;
  let sumCashflow = 0;
  let sumSpeed = 0;
  let count = 0;

  for (let i = history.length - 1; i >= 0; i--) {
    const pt = history[i];
    if (now - pt.time > windowMs) break;
    sumLoad += (pt.load || 0);
    sumUtil += (pt.utilization || 0);
    sumCashflow += (pt.cashflow || 0);
    sumSpeed += (pt.speed || 0);
    count++;
  }

  if (count === 0) {
    const last = history[history.length - 1];
    return { load: last.load || 0, util: last.utilization || 0, cashflow: last.cashflow || 0, speed: last.speed || 0, samples: 1 };
  }

  return {
    load: Math.round((sumLoad / count) * 10) / 10,
    util: Math.round(sumUtil / count),
    cashflow: Math.round(sumCashflow / count),
    speed: Math.round(sumSpeed / count),
    samples: count
  };
}

function processTelemetryTick(data) {
  const now = Date.now();
  lastIngestTime = now;
  const formattedCalendarDate = formatGameCalendarDate(data.gameTime, data.gameDate);

  // Track Simulation Pause State & Speed Multiplier
  if (data.isPaused !== undefined) {
    currentSimState = data.isPaused ? 'PAUSED' : 'RUNNING';
    currentSimSpeed = (typeof data.simSpeed === 'number') ? data.simSpeed : (data.isPaused ? 0.0 : 1.0);
    lastSeenGameTimeChangeTs = now;
  } else if (typeof data.gameTime === 'number' && data.gameTime > 0) {
    const realDt = (now - lastRealTickTs) / 1000;
    if (lastSeenGameTime > 0 && realDt > 1.0) {
      const gameDt = (data.gameTime - lastSeenGameTime) / 1000;
      if (gameDt <= 0.01) {
        // Only mark paused if no gameTime increase for more than 6 seconds
        if (now - lastSeenGameTimeChangeTs > 6000) {
          currentSimState = 'PAUSED';
          currentSimSpeed = 0.0;
        }
      } else {
        currentSimState = 'RUNNING';
        lastSeenGameTimeChangeTs = now;
        const speedRatio = gameDt / realDt;
        if (speedRatio < 1.4) currentSimSpeed = 1.0;
        else if (speedRatio < 2.8) currentSimSpeed = 2.0;
        else currentSimSpeed = 4.0;
      }
    }
    lastSeenGameTime = data.gameTime;
    lastRealTickTs = now;
  } else {
    currentSimState = 'RUNNING';
    currentSimSpeed = 1.0;
  }

  // --- Fleet Vehicle Replacement & Modernization Advisor (Passenger vs Cargo strict separation) ---
  function computeFleetVehicleAdvice(line, gameYear = 1987) {
    const isPax = !!line.isOpnv || line.carrierCategory === 'ROAD_PERSON' || (line.cargoType || '').toLowerCase().includes('passagier');
    const carrier = line.carrierCategory || line.carrier || (isPax ? 'ROAD_PERSON' : 'ROAD_CARGO');
    const cargoType = line.cargoType || (isPax ? 'Passagiere' : 'General');
    const vCount = line.vehicleCount || (line.vehicles ? line.vehicles.length : 0);
    const totalCap = line.capacity || 0;
    const vCap = vCount > 0 ? Math.round(totalCap / vCount) : (line.vehicles && line.vehicles[0] ? line.vehicles[0].capacity : 10);
    const avgAge = line.avgAgeYears || 0;
    const costPenalty = line.costPenalty || 0;
    const waiting = line.totalWaiting || 0;
    const util = line.avgUtil60s !== undefined ? line.avgUtil60s : (line.utilization || 0);

    // 1. Identify Current Vehicle Class/Model
    let currentModel = '';
    let currentShort = '';

    if (isPax) {
      if (carrier === 'RAIL') {
        if (vCap <= 40) { currentModel = 'Preußische T3 Personenzug (40 Pax)'; currentShort = 'T3 Dampfzug (40 Pax)'; }
        else if (vCap <= 100) { currentModel = 'Silberlinge / n-Wagen (80 Pax)'; currentShort = 'n-Wagen (80 Pax)'; }
        else { currentModel = 'IC 79 / Großraum-Schnellzug (160 Pax)'; currentShort = 'IC Schnellzug (160 Pax)'; }
      } else if (carrier === 'WATER') {
        if (vCap <= 35) { currentModel = 'Historischer Raddampfer (30 Pax)'; currentShort = 'Raddampfer (30 Pax)'; }
        else { currentModel = 'Passagierschiff / Motorfähre (80 Pax)'; currentShort = 'Motorfähre (80 Pax)'; }
      } else {
        // ROAD_PERSON (Busses & Trams)
        if (vCap <= 10) { currentModel = 'Daimler Landauer / Vintage Bus (10 Pax)'; currentShort = '10-Pax Vintage Bus'; }
        else if (vCap <= 15) { currentModel = 'Mercedes-Benz O 3500 (15 Pax)'; currentShort = 'MB O 3500 (15 Pax)'; }
        else if (vCap <= 20) { currentModel = 'Mercedes-Benz O 305 / MAN SL 200 (20 Pax)'; currentShort = 'MB O 305 (20 Pax)'; }
        else if (vCap <= 28) { currentModel = 'Mercedes-Benz O 405 (24 Pax)'; currentShort = 'MB O 405 (24 Pax)'; }
        else { currentModel = 'MAN SG 240 Gelenkbus (40 Pax)'; currentShort = 'SG 240 Gelenkbus (40 Pax)'; }
      }
    } else {
      // CARGO
      const isLiquid = /oil|fuel|crude|öl|treibstoff|benzin/i.test(cargoType);
      if (carrier === 'WATER') {
        if (vCap <= 30) { currentModel = isLiquid ? 'Kleiner Dampf-Tanker (30 Fracht)' : 'Dampffrachter (30 Fracht)'; currentShort = 'Dampfschiff (30 Fracht)'; }
        else if (vCap <= 60) { currentModel = isLiquid ? 'Motortankschiff (60 Fracht)' : 'Motorschiff MS Klosters (60 Fracht)'; currentShort = 'MS Klosters (60 Fracht)'; }
        else { currentModel = 'Großes Binnenschiff / Schubverband (120 Fracht)'; currentShort = 'Binnenschiff (120 Fracht)'; }
      } else if (carrier === 'RAIL') {
        currentModel = isLiquid ? 'Kesselwagen-Güterzug (150 Fracht)' : 'Schüttgut / Flachwagen-Güterzug (180 Fracht)';
        currentShort = 'Güterzug';
      } else {
        // ROAD_CARGO (Trucks)
        if (isLiquid) {
          if (vCap <= 12) { currentModel = 'Früher Kesselwagen-LKW (10-12 Fracht)'; currentShort = 'Kessel-LKW (12 Fracht)'; }
          else if (vCap <= 18) { currentModel = 'Büssing Tankwagen (15-18 Fracht)'; currentShort = 'Büssing Tank (18 Fracht)'; }
          else { currentModel = 'MAN F8 / Mercedes NG Tankauflieger (24 Fracht)'; currentShort = 'MAN F8 Tank (24 Fracht)'; }
        } else {
          if (vCap <= 12) { currentModel = 'Benz Gaggenau / Saurer 5BLD (12 Fracht)'; currentShort = 'Benz Gaggenau (12 Fracht)'; }
          else if (vCap <= 15) { currentModel = 'Opel Blitz / Magirus Sirius (15 Fracht)'; currentShort = 'Opel Blitz (15 Fracht)'; }
          else if (vCap <= 18) { currentModel = 'Mercedes-Benz Kurzhauber L 325 (18 Fracht)'; currentShort = 'MB Kurzhauber (18 Fracht)'; }
          else if (vCap <= 25) { currentModel = 'MAN F8 / Mercedes NG (22-25 Fracht)'; currentShort = 'MAN F8 (22-25 Fracht)'; }
          else { currentModel = '40t Fernverkehr-Sattelzug (32-40 Fracht)'; currentShort = '40t Sattelzug (32 Fracht)'; }
        }
      }
    }

    // 2. Determine Action & Target Vehicle
    let action = 'BALANCED'; // 'SWAP' | 'UPGRADE' | 'ADD' | 'REMOVE' | 'BALANCED'
    let targetModel = '';
    let targetShort = '';
    let recommendedCount = vCount;
    let urgency = 'LOW';
    let reason = '';
    let reasonEn = '';
    let targetCap = vCap;

    const isOld = avgAge >= 25 || costPenalty >= 5;
    const hasBacklog = waiting >= 50;
    const isGhost = vCount >= 3 && util < 20;

    if (vCount === 0) {
      action = 'ADD';
      urgency = 'HIGH';
      if (isPax) {
        targetModel = 'Mercedes-Benz O 405 (24 Pax, 85 km/h)';
        targetShort = 'MB O 405 (24 Pax)';
        recommendedCount = 1;
      } else {
        const isLiquid = /oil|fuel|crude|öl|treibstoff/i.test(cargoType);
        targetModel = isLiquid ? 'MAN F8 Tankauflieger (24 Fracht, 80 km/h)' : 'MAN F8 Pritsche/Plane (22 Fracht, 80 km/h)';
        targetShort = isLiquid ? 'MAN F8 Tanker (24 Fracht)' : 'MAN F8 LKW (22 Fracht)';
        recommendedCount = 1;
      }
      reason = 'Linie hat 0 Fahrzeuge! Weise 1 Fahrzeug zu, um den Betrieb aufzunehmen.';
      reasonEn = 'Route has 0 vehicles! Assign 1 vehicle to start operations.';
    } else if (isOld) {
      // SWAP / FLOTTENERNEUERUNG
      action = 'SWAP';
      urgency = costPenalty >= 10 ? 'HIGH' : 'MEDIUM';

      if (isPax) {
        if (carrier === 'ROAD_PERSON') {
          if (hasBacklog || (totalCap > 0 && totalCap < waiting)) {
            targetModel = 'MAN SG 240 Gelenkbus (40 Pax, 80 km/h)';
            targetShort = 'MAN SG 240 (40 Pax)';
            targetCap = 40;
            recommendedCount = Math.max(1, Math.ceil(Math.max(totalCap, waiting * 0.8) / 40));
            reason = `Flotte überaltert (${Math.round(avgAge)}J alt, +${costPenalty}% Strafe) & Überlastung (+${waiting} Pax). Tausche auf moderne Gelenkbusse: Löst Rückstau und spart Strafkosten!`;
            reasonEn = `Fleet overaged (${Math.round(avgAge)}y old, +${costPenalty}% penalty) & congestion (+${waiting} pax). Swap to articulated busses: resolves backlog and saves maintenance penalty!`;
          } else {
            targetModel = 'Mercedes-Benz O 405 (24 Pax, 85 km/h)';
            targetShort = 'MB O 405 (24 Pax)';
            targetCap = 24;
            recommendedCount = Math.max(1, Math.ceil((totalCap || 24) / 24));
            const unitDiff = vCount - recommendedCount;
            const trafficSavings = unitDiff > 0 ? `, reduziert Flotte von ${vCount} auf ${recommendedCount} Einheiten (kein Stau mehr!)` : '';
            const trafficSavingsEn = unitDiff > 0 ? `, reduces fleet count from ${vCount} to ${recommendedCount} (eliminates road traffic!)` : '';
            reason = `Flotte überaltert (${Math.round(avgAge)}J alt, +${costPenalty}% Strafe). Ersetze durch MB O 405 (24 Pax): 0% Strafe, +45 km/h schneller${trafficSavings}.`;
            reasonEn = `Fleet overaged (${Math.round(avgAge)}y old, +${costPenalty}% penalty). Replace with MB O 405 (24 Pax): 0% penalty, +45 km/h faster${trafficSavingsEn}.`;
          }
        } else if (carrier === 'WATER') {
          targetModel = 'Moderne Passagierfähre (80 Pax, 35 km/h)';
          targetShort = 'Passagierfähre (80 Pax)';
          recommendedCount = Math.max(1, Math.ceil((totalCap || 80) / 80));
          reason = `Ersetze alten Raddampfer durch moderne Motorfähre (0% Strafe, höhere Kapazität).`;
          reasonEn = `Replace vintage steamer with modern motor ferry (0% penalty, higher capacity).`;
        }
      } else {
        // CARGO
        const isLiquid = /oil|fuel|crude|öl|treibstoff/i.test(cargoType);
        if (carrier === 'ROAD_CARGO') {
          if (isLiquid) {
            targetModel = 'MAN F8 Tankauflieger (24 Fracht, 80 km/h)';
            targetShort = 'MAN F8 Tanker (24 Fracht)';
            targetCap = 24;
          } else {
            targetModel = 'MAN F8 Pritsche/Plane (22 Fracht, 80 km/h)';
            targetShort = 'MAN F8 (22 Fracht)';
            targetCap = 22;
          }
          recommendedCount = Math.max(1, Math.ceil((totalCap || targetCap) / targetCap));
          const unitDiff = vCount - recommendedCount;
          const truckDiffStr = unitDiff > 0 ? ` und reduziert Konvoi von ${vCount} auf ${recommendedCount} LKW (entlastet Kreuzungen!)` : '';
          const truckDiffStrEn = unitDiff > 0 ? ` and reduces fleet from ${vCount} to ${recommendedCount} trucks (clears road junctions!)` : '';
          reason = `LKW-Flotte überaltert (${Math.round(avgAge)}J alt, +${costPenalty}% Strafe). Ersetze durch moderne ${targetShort}: Spart ca. $${Math.round((line.runningCosts || 0) * (costPenalty/100)).toLocaleString()}/J Strafkosten${truckDiffStr}.`;
          reasonEn = `Truck fleet overaged (${Math.round(avgAge)}y old, +${costPenalty}% penalty). Replace with modern ${targetShort}: Saves ~$${Math.round((line.runningCosts || 0) * (costPenalty/100)).toLocaleString()}/yr penalties${truckDiffStrEn}.`;
        } else if (carrier === 'WATER') {
          targetModel = isLiquid ? 'Modernes Motortankschiff (60 Fracht, 35 km/h)' : 'Motorschiff MS Klosters (60 Fracht, 35 km/h)';
          targetShort = isLiquid ? 'Tankschiff (60 Fracht)' : 'MS Klosters (60 Fracht)';
          recommendedCount = Math.max(1, Math.ceil((totalCap || 60) / 60));
          reason = `Dampfschiff überaltert. Tausche auf MS Klosters (verdoppelt Ladevolumen 30 ➔ 60 Fracht, 0% Strafe).`;
          reasonEn = `Steamer overaged. Swap to MS Klosters (doubles volume 30 ➔ 60 cargo, 0% penalty).`;
        }
      }
    } else if (hasBacklog) {
      // BOTTLENECK UPGRADE
      action = 'UPGRADE';
      urgency = 'HIGH';
      if (isPax) {
        if (carrier === 'ROAD_PERSON') {
          if (vCap < 35) {
            targetModel = 'MAN SG 240 Gelenkbus (40 Pax, 80 km/h)';
            targetShort = 'MAN SG 240 (40 Pax)';
            recommendedCount = Math.max(vCount, Math.ceil((totalCap + waiting) / 40));
            reason = `Großer Fahrgastandrang (+${waiting} wartende Pax). Upgrade auf MAN SG 240 Gelenkbusse räumt Haltestellen frei ohne Stau durch Kleinbusse.`;
            reasonEn = `Severe passenger surge (+${waiting} waiting). Upgrade to MAN SG 240 articulated busses clears stops without road clogging.`;
          } else {
            action = 'ADD';
            targetModel = currentModel;
            targetShort = currentShort;
            recommendedCount = vCount + 1;
            reason = `Haltestelle überlastet (+${waiting} wartende Pax). Füge +1 Fahrzeug zu dieser Linie hinzu.`;
            reasonEn = `Terminal overloaded (+${waiting} waiting). Add +1 vehicle to this route.`;
          }
        }
      } else {
        // CARGO BACKLOG
        const isLiquid = /oil|fuel|crude|öl|treibstoff/i.test(cargoType);
        if (carrier === 'ROAD_CARGO') {
          if (vCap < 20) {
            targetModel = isLiquid ? 'MAN F8 Tankauflieger (24 Fracht, 80 km/h)' : 'MAN F8 Pritsche/Plane (22 Fracht, 80 km/h)';
            targetShort = isLiquid ? 'MAN F8 Tanker (24 Fracht)' : 'MAN F8 (22 Fracht)';
            recommendedCount = vCount;
            reason = `Frachtstau (+${waiting} Einheiten). Tausche Klein-LKW (${vCap}t) gegen schwere ${targetShort} für höheren Durchsatz.`;
            reasonEn = `Freight backlog (+${waiting} units). Swap smaller trucks (${vCap}t) to heavy ${targetShort} for maximum throughput.`;
          } else {
            action = 'ADD';
            targetModel = currentModel;
            targetShort = currentShort;
            recommendedCount = vCount + 1;
            reason = `Güter-Rückstau (+${waiting} Einheiten). Füge +1 LKW hinzu, um Fabriken im Fluss zu halten.`;
            reasonEn = `Cargo backlog (+${waiting} units). Add +1 truck to keep connected industries flowing.`;
          }
        }
      }
    } else if (isGhost) {
      // GHOST FLEET / DOWNSIZE
      action = 'REMOVE';
      urgency = 'MEDIUM';
      targetModel = currentModel;
      targetShort = currentShort;
      recommendedCount = Math.max(1, vCount - 1);
      const vCost = vCount > 0 ? Math.round((line.runningCosts || 0) / vCount) : 0;
      reason = `Überkapazität (nur ${util}% Auslastung). 1 Fahrzeug abziehen oder ins Depot senden (spart ca. $${vCost.toLocaleString()}/J Betriebskosten).`;
      reasonEn = `Overcapacity (only ${util}% utilization). Withdraw 1 vehicle to depot (saves ~$${vCost.toLocaleString()}/yr operating costs).`;
    } else {
      // BALANCED / OPTIMAL
      action = 'BALANCED';
      targetModel = currentModel;
      targetShort = currentShort;
      recommendedCount = vCount;
      reason = 'Flotte läuft optimal eingetaktet mit passendem Fahrzeugtyp.';
      reasonEn = 'Fleet is operating optimally balanced with matching vehicle type.';
    }

    return {
      action,
      isPax,
      paxOrCargo: isPax ? 'PASSENGER' : 'CARGO',
      carrierCategory: carrier,
      cargoType,
      currentModel,
      currentShort,
      targetModel: targetModel || currentModel,
      targetShort: targetShort || currentShort,
      currentCount: vCount,
      recommendedCount,
      unitDifference: recommendedCount - vCount,
      urgency,
      reason,
      reasonEn,
      potentialSavingsYear: Math.round((line.runningCosts || 0) * (costPenalty / 100))
    };
  }

  const rawLines = data.lines || [];
  const sessionElapsedMin = Math.max(0.1, (now - sessionStartTime) / 60000);
  const effectiveSimSpeed = (typeof currentSimSpeed === 'number' && currentSimSpeed > 0) ? currentSimSpeed : 1.0;
  const realMinutesPerIngameYear = 12.16 / effectiveSimSpeed;
  const realMinutesPerIngameDay = realMinutesPerIngameYear / 365;
  const sessionIngameDays = Math.max(1, (sessionElapsedMin / realMinutesPerIngameYear) * 365);

  let totalNetworkLoad = 0;
  let totalNetworkCap = 0;
  let totalNetworkWaiting = 0;
  let totalPaxLoad = 0;
  let totalPaxCap = 0;
  let totalPaxWaiting = 0;
  let totalCargoLoad = 0;
  let totalCargoCap = 0;
  let totalCargoWaiting = 0;
  let totalRunningCostsPerYear = 0;
  let totalCashflow60s = 0;

  const processedLines = [];

  for (const l of rawLines) {
    const lid = l.id;
    const carrier = classifyLine(l.name, l.vehicles, l.carrier, l.isOpnv);
    l.carrierCategory = carrier;
    if (carrier === 'ROAD_PERSON') {
      l.cargoType = 'Passagiere';
      l.isOpnv = true;
    } else {
      l.isOpnv = false;
      if (!l.cargoType || l.cargoType === 'Passagiere') l.cargoType = 'Fracht';
    }

    // Sliding window 60s
    if (!line60sBuffer[lid]) line60sBuffer[lid] = [];
    const buf = line60sBuffer[lid];
    buf.push({
      time: now,
      load: l.load || 0,
      util: l.utilization || 0,
      cashflow: l.cashflow || 0,
      speed: l.avgSpeed || 0
    });

    while (buf.length > 0 && (now - buf[0].time > 60000)) {
      buf.shift();
    }

    const samples = buf.length;
    const avgLoad60s = samples > 0 ? (buf.reduce((a, b) => a + b.load, 0) / samples) : (l.load || 0);
    const avgUtil60s = samples > 0 ? Math.round(buf.reduce((a, b) => a + b.util, 0) / samples) : (l.utilization || 0);
    const cashflow60s = buf.reduce((a, b) => a + b.cashflow, 0);
    const avgSpeed60s = samples > 0 ? Math.round(buf.reduce((a, b) => a + b.speed, 0) / samples) : (l.avgSpeed || 0);

    // Long-term Session Cumulative
    if (!sessionCumulative[lid]) {
      sessionCumulative[lid] = { totalCashflow: 0, samples: 0, loadSum: 0, speedSum: 0, peakLoad: 0 };
    }
    const cum = sessionCumulative[lid];
    cum.samples += 1;
    cum.totalCashflow += (l.cashflow || 0);
    cum.loadSum += (l.load || 0);
    cum.speedSum += (l.avgSpeed || 0);
    if ((l.load || 0) > cum.peakLoad) cum.peakLoad = (l.load || 0);

    const sessionAvgLoad = cum.samples > 0 ? Math.round((cum.loadSum / cum.samples) * 10) / 10 : 0;
    const sessionAvgSpeed = cum.samples > 0 ? Math.round(cum.speedSum / cum.samples) : 0;
    const sessionEarningsPerMin = Math.round(cum.totalCashflow / sessionElapsedMin);

    // Time-series history for charts (up to 1800 points = 1h)
    if (!lineHistory[lid]) lineHistory[lid] = [];
    lineHistory[lid].push({
      time: now,
      gameDate: formattedCalendarDate || data.gameDate || '',
      gameTime: data.gameTime || 0,
      load: l.load || 0,
      capacity: l.capacity || 0,
      utilization: l.utilization || 0,
      cashflow: cashflow60s,
      speed: l.avgSpeed || 0,
      waiting: l.totalWaiting || 0
    });
    if (lineHistory[lid].length > HISTORY_MAX_POINTS) {
      lineHistory[lid].shift();
    }

    // Per Vehicle earnings
    const vCount = l.vehicleCount || 0;
    const earningsPerVehicle = vCount > 0 ? Math.round(cashflow60s / vCount) : 0;

    // Detect operational status & problems
    let problemType = null;
    let statusText = 'Aktiv';
    let statusTextEn = 'Active';
    let statusLevel = 'success'; // success, warn, danger

    if (l.lineIssue && l.lineIssue !== 'None') {
      problemType = 'ENGINE_ISSUE';
      statusText = `⚠️ ${l.lineIssue}`;
      statusTextEn = `⚠️ ${l.lineIssue}`;
      statusLevel = 'danger';
    } else if (l.vehicleCount > 0 && (l.avgSpeed || 0) === 0 && (l.load || 0) > 0) {
      problemType = 'TRAFFIC_JAM';
      statusText = '⚠️ Stau (0 km/h)';
      statusTextEn = '⚠️ Traffic Jam (0 km/h)';
      statusLevel = 'danger';
    } else if (l.vehicleCount > 0 && l.emptyVehicles === l.vehicleCount) {
      problemType = 'EMPTY_FLEET';
      statusText = '⚠️ 100% Leerfahrten';
      statusTextEn = '⚠️ 100% Empty Runs';
      statusLevel = 'warn';
    } else if ((l.costPenalty || 0) >= 15) {
      problemType = 'MAINTENANCE_DUE';
      statusText = `🔧 Wartung (${l.costPenalty}% Strafe)`;
      statusTextEn = `🔧 Maintenance (${l.costPenalty}% Penalty)`;
      statusLevel = 'warn';
    } else if ((l.totalWaiting || 0) > 120) {
      problemType = 'TERMINAL_OVERFLOW';
      statusText = `📦 Überfüllt (${l.totalWaiting})`;
      statusTextEn = `📦 Congested (${l.totalWaiting})`;
      statusLevel = 'warn';
    }

    // Historical slope / Trend over past points
    const hist = lineHistory[lid];
    const pastIdx5m = Math.max(0, hist.length - 150);
    const past5mPoint = hist.length > 30 ? hist[pastIdx5m] : null;
    const cashflowSlope5m = past5mPoint ? (cashflow60s - past5mPoint.cashflow) : 0;

    // Multi-Horizon Projections (1m, 5m, 10m, 30m, 1h)
    const proj5m = Math.round(cashflow60s * 5);
    const proj10m = Math.round(cashflow60s * 10);
    const proj30m = Math.round(cashflow60s * 30);
    const proj1h = Math.round(cashflow60s * 60);

    // AI Smart Recommendation & Potential Savings with Vehicle Replacement Advisor
    const vehicleAdvice = computeFleetVehicleAdvice(l, 1987);
    let recommendation = vehicleAdvice.reason;
    let recommendationEn = vehicleAdvice.reasonEn;
    let potentialSavingsYear = vehicleAdvice.potentialSavingsYear || 0;

    if (vehicleAdvice.action === 'SWAP') {
      recommendation = `Flotte tauschen: ${vehicleAdvice.currentShort} ➔ ${vehicleAdvice.targetShort} (spart ca. $${Math.round(potentialSavingsYear).toLocaleString()}/J)`;
      recommendationEn = `Swap fleet: ${vehicleAdvice.currentShort} ➔ ${vehicleAdvice.targetShort} (saves ~$${Math.round(potentialSavingsYear).toLocaleString()}/yr)`;
    } else if (vehicleAdvice.action === 'UPGRADE') {
      recommendation = `Upgrade: ${vehicleAdvice.currentShort} ➔ ${vehicleAdvice.targetShort} (+${l.totalWaiting} wartend)`;
      recommendationEn = `Upgrade: ${vehicleAdvice.currentShort} ➔ ${vehicleAdvice.targetShort} (+${l.totalWaiting} waiting)`;
    } else if (vehicleAdvice.action === 'ADD') {
      recommendation = `Takt verdichten / +1 Fahrzeug zufügen (+${l.totalWaiting} wartend)`;
      recommendationEn = `Tighten headway / add +1 vehicle (+${l.totalWaiting} waiting)`;
    } else if (vehicleAdvice.action === 'REMOVE') {
      const vCost = Math.round((l.runningCosts || 0) / Math.max(1, vCount));
      recommendation = `1 Fahrzeug abziehen (spart ca. $${Math.round(vCost).toLocaleString()}/J)`;
      recommendationEn = `Withdraw 1 vehicle (saves ~$${Math.round(vCost).toLocaleString()}/yr)`;
      potentialSavingsYear = vCost;
    } else if (cashflow60s < -3000) {
      recommendation = `Linie prüfen: Defizit ca. $${Math.abs(proj1h).toLocaleString()}/h`;
      recommendationEn = `Inspect route: Deficit approx. $${Math.abs(proj1h).toLocaleString()}/hr`;
    } else if (cashflow60s > 10000 && avgUtil60s > 75) {
      recommendation = `Top-Performer: Perfekte Auslastung & Erträge`;
      recommendationEn = `Top performer: High utilization & revenue`;
    }

    // Pattern Recognition categorization
    let patternTag = null;
    let patternSeverity = 'info';
    if (cashflow60s < -2000 && cashflowSlope5m < -500) {
      patternTag = 'DEFICIT_SPIRAL';
      patternSeverity = 'danger';
    } else if (vCount >= 3 && avgUtil60s < 20) {
      patternTag = 'GHOST_FLEET';
      patternSeverity = 'warn';
    } else if ((l.costPenalty || 0) >= 10) {
      patternTag = 'MAINT_PENALTY';
      patternSeverity = 'warn';
    } else if ((l.totalWaiting || 0) > 80) {
      patternTag = 'BOTTLENECK';
      patternSeverity = 'warn';
    } else if (cashflow60s > 12000 && avgUtil60s >= 70) {
      patternTag = 'CASH_CHAMPION';
      patternSeverity = 'success';
    }

    const liveUtil = l.capacity > 0 ? Math.round((l.load / l.capacity) * 100) : 0;
    const avg1m = computeWindowAverage(lineHistory[lid], 60000, now);
    const avg5m = computeWindowAverage(lineHistory[lid], 300000, now);
    const avg15m = computeWindowAverage(lineHistory[lid], 900000, now);
    const avg30m = computeWindowAverage(lineHistory[lid], 1800000, now);
    const avgSession = {
      load: sessionAvgLoad,
      util: l.capacity > 0 ? Math.round((sessionAvgLoad / l.capacity) * 100) : 0,
      cashflow: sessionEarningsPerMin,
      speed: sessionAvgSpeed,
      totalCashflow: cum.totalCashflow,
      samples: cum.samples
    };
    const lineAvgPerDay = Math.round((cum.totalCashflow || 0) / sessionIngameDays);
    const lineAvgPerMonth = Math.round(lineAvgPerDay * 30.4166);
    const lineAvgPerYear = Math.round(lineAvgPerDay * 365);

    const enhancedLine = {
      ...l,
      liveUtil,
      liveLoad: l.load || 0,
      liveSpeed: l.avgSpeed || 0,
      liveCashflow: l.cashflow || 0,
      avg1m,
      avg5m,
      avg15m,
      avg30m,
      avgSession,
      avgPerDay: lineAvgPerDay,
      avgPerMonth: lineAvgPerMonth,
      avgPerYear: lineAvgPerYear,
      lineAvgPerDay,
      lineAvgPerMonth,
      lineAvgPerYear,
      sessionTotalCashflow: cum.totalCashflow,
      avgLoad60s: Math.round(avgLoad60s * 10) / 10,
      avgUtil60s,
      avgSpeed60s,
      cashflow60s,
      earningsPerVehicle,
      sessionAvgLoad,
      sessionAvgSpeed,
      sessionEarningsPerMin,
      problemType,
      statusText,
      statusTextEn,
      statusLevel,
      cashflowSlope5m,
      proj5m,
      proj10m,
      proj30m,
      proj1h,
      recommendation,
      recommendationEn,
      potentialSavingsYear,
      patternTag,
      patternSeverity,
      vehicleAdvice,
      sparklineUtil: (lineHistory[lid] || []).slice(-16).map(pt => pt.utilization !== undefined ? pt.utilization : (pt.util || 0)),
      sparklineCashflow: (lineHistory[lid] || []).slice(-16).map(pt => pt.cashflow || 0)
    };

    processedLines.push(enhancedLine);

    totalNetworkLoad += (l.load || 0);
    totalNetworkCap += (l.capacity || 0);
    totalNetworkWaiting += (l.totalWaiting || 0);
    totalRunningCostsPerYear += (l.runningCosts || 0);
    totalCashflow60s += cashflow60s;

    if (carrier === 'ROAD_PERSON' || l.isOpnv) {
      totalPaxLoad += (l.load || 0);
      totalPaxCap += (l.capacity || 0);
      totalPaxWaiting += (l.totalWaiting || 0);
    } else {
      totalCargoLoad += (l.load || 0);
      totalCargoCap += (l.capacity || 0);
      totalCargoWaiting += (l.totalWaiting || 0);
    }
  }

  const paxLines = processedLines.filter(l => l.carrierCategory === 'ROAD_PERSON' || l.isOpnv);
  const cargoLines = processedLines.filter(l => !(l.carrierCategory === 'ROAD_PERSON' || l.isOpnv));

  const paxSummary = (data.paxSummary && data.paxSummary.capacity > 0) ? data.paxSummary : {
    load: totalPaxLoad,
    capacity: totalPaxCap,
    waiting: totalPaxWaiting,
    lineCount: paxLines.length,
    vehicleCount: paxLines.reduce((sum, l) => sum + (l.vehicleCount || 0), 0),
    util: totalPaxCap > 0 ? Math.round((totalPaxLoad / totalPaxCap) * 100) : 0
  };

  const cargoSummary = (data.cargoSummary && data.cargoSummary.capacity > 0) ? data.cargoSummary : {
    load: totalCargoLoad,
    capacity: totalCargoCap,
    waiting: totalCargoWaiting,
    lineCount: cargoLines.length,
    vehicleCount: cargoLines.reduce((sum, l) => sum + (l.vehicleCount || 0), 0),
    util: totalCargoCap > 0 ? Math.round((totalCargoLoad / totalCargoCap) * 100) : 0
  };

  // Sortings for Top 5 Earners & Losers
  const sortedByProfit = [...processedLines].sort((a, b) => b.cashflow60s - a.cashflow60s);
  const topEarners = sortedByProfit.filter(l => l.cashflow60s > 0).slice(0, 5);
  const topLosers = [...processedLines].sort((a, b) => a.cashflow60s - b.cashflow60s).filter(l => l.cashflow60s < 0).slice(0, 5);
  const problemLines = processedLines.filter(l => l.problemType !== null || l.patternTag === 'DEFICIT_SPIRAL' || l.patternTag === 'GHOST_FLEET');

  const overallUtil = totalNetworkCap > 0 ? Math.round((totalNetworkLoad / totalNetworkCap) * 100) : 0;
  const runningCostsPerMin = Math.round(totalRunningCostsPerYear / 525600 * 60);


  let playDurationStr = data.playDuration || (data.gameDate && data.gameDate.match(/^\d+h\s*\d+m$/) ? data.gameDate : '');
  if (!playDurationStr && data.gameTime && typeof data.gameTime === 'number' && data.gameTime > 0) {
    const totalSec = Math.floor(data.gameTime / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    playDurationStr = `${hrs}h ${mins}m`;
  }

  // Network time-series record with In-Game Date
  const netPoint = {
    time: now,
    gameDate: formattedCalendarDate || data.gameDate || '',
    gameTime: data.gameTime || 0,
    isPaused: data.isPaused || false,
    cashflow: totalCashflow60s,
    load: totalNetworkLoad,
    capacity: totalNetworkCap,
    utilization: overallUtil,
    waiting: totalNetworkWaiting,
    paxLoad: totalPaxLoad,
    paxCap: totalPaxCap,
    paxUtil: totalPaxCap > 0 ? Math.round((totalPaxLoad / totalPaxCap) * 100) : 0,
    paxWaiting: totalPaxWaiting,
    cargoLoad: totalCargoLoad,
    cargoCap: totalCargoCap,
    cargoUtil: totalCargoCap > 0 ? Math.round((totalCargoLoad / totalCargoCap) * 100) : 0,
    cargoWaiting: totalCargoWaiting,
    speed: processedLines.length ? Math.round(processedLines.reduce((s, l) => s + (l.avgSpeed60s || 0), 0) / processedLines.length) : 0,
    maint: processedLines.length ? Math.round(processedLines.reduce((s, l) => s + (l.maintState || 0), 0) / processedLines.length) : 100,
    penaltiesSum: processedLines.reduce((s, l) => s + (l.costPenalty || 0), 0),
    top5: topEarners.map(l => ({ id: l.id, name: l.name, cashflow: l.cashflow60s })),
    flop5: topLosers.map(l => ({ id: l.id, name: l.name, cashflow: l.cashflow60s }))
  };
  networkHistory.push(netPoint);
  if (networkHistory.length > HISTORY_MAX_POINTS) networkHistory.shift();

  // Helper for network window averages
  function getNetworkWindowAverages(history, windowMs) {
    let sumLoad = 0, sumCap = 0, sumCash = 0, sumSpeed = 0, count = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      const pt = history[i];
      if (now - pt.time > windowMs) break;
      sumLoad += (pt.load || 0);
      sumCap += (pt.capacity || 0);
      sumCash += (pt.cashflow || 0);
      sumSpeed += (pt.speed || 0);
      count++;
    }
    if (count === 0) return { util: overallUtil, load: totalNetworkLoad, capacity: totalNetworkCap, cashflow: totalCashflow60s, speed: 0, samples: 1 };
    const avgLoad = Math.round(sumLoad / count);
    const avgCap = Math.round(sumCap / count);
    const util = avgCap > 0 ? Math.round((avgLoad / avgCap) * 100) : 0;
    const cashflow = Math.round(sumCash / count);
    const speed = Math.round(sumSpeed / count);
    return { util, load: avgLoad, capacity: avgCap, cashflow, speed, samples: count };
  }

  const networkAverages = {
    '1m': getNetworkWindowAverages(networkHistory, 60000),
    '5m': getNetworkWindowAverages(networkHistory, 300000),
    '15m': getNetworkWindowAverages(networkHistory, 900000),
    '30m': getNetworkWindowAverages(networkHistory, 1800000),
    'session': getNetworkWindowAverages(networkHistory, Infinity)
  };

  // Pattern Alerts list
  const patternAlerts = processedLines
    .filter(l => l.patternTag && l.patternSeverity !== 'info')
    .map(l => ({
      lineId: l.id,
      lineName: l.name,
      carrier: l.carrierCategory,
      tag: l.patternTag,
      severity: l.patternSeverity,
      cashflow60s: l.cashflow60s,
      waiting: l.totalWaiting,
      utilization: l.avgUtil60s,
      recommendation: l.recommendation,
      recommendationEn: l.recommendationEn,
      savingsYear: l.potentialSavingsYear
    }));

  // --- Vehicle Shift Suggestions between Lines ---
  function computeVehicleTransferSuggestions(lines) {
    const suggestions = [];
    if (!lines || lines.length < 2) return suggestions;

    const donors = lines.filter(l => 
      ((l.vehicleCount || 0) >= 2 && ((l.avgUtil60s !== undefined ? l.avgUtil60s : l.utilization) <= 40)) ||
      ((l.vehicleCount || 0) >= 1 && (l.utilization || 0) === 0 && (l.totalWaiting || 0) === 0 && (l.load || 0) === 0)
    );

    const receivers = lines.filter(l => 
      (l.totalWaiting || 0) >= 25 || 
      ((l.avgUtil60s !== undefined ? l.avgUtil60s : l.utilization) >= 80)
    );

    for (const donor of donors) {
      const isPaxDonor = donor.carrierCategory === 'ROAD_PERSON' || donor.carrier === 'ROAD_PERSON' || donor.isOpnv;
      const match = receivers.find(r => {
        if (r.id === donor.id) return false;
        const isPaxReceiver = r.carrierCategory === 'ROAD_PERSON' || r.carrier === 'ROAD_PERSON' || r.isOpnv;
        return isPaxDonor === isPaxReceiver;
      });

      if (match) {
        const waitingCount = match.totalWaiting || 0;
        const donorUtil = donor.avgUtil60s !== undefined ? donor.avgUtil60s : (donor.utilization || 0);
        suggestions.push({
          fromLineId: donor.id,
          fromLineName: donor.name,
          toLineId: match.id,
          toLineName: match.name,
          carrier: isPaxDonor ? 'ROAD_PERSON' : 'ROAD_CARGO',
          cargoType: donor.cargoType || match.cargoType || 'Diverse',
          count: 1,
          urgency: waitingCount >= 40 ? 'HIGH' : 'MEDIUM',
          title: `Verschiebung: ${donor.name} ➔ ${match.name}`,
          titleEn: `Transfer: ${donor.name} ➔ ${match.name}`,
          reason: `Linie '${donor.name}' hat Überkapazität (${donorUtil}% Auslastung). 1 Fahrzeug auf '${match.name}' verlegen (${waitingCount > 0 ? waitingCount + ' Fahrgäste/Güter stauen sich' : 'hohe Auslastung'}).`,
          reasonEn: `Line '${donor.name}' has low util (${donorUtil}%). Shift 1 vehicle to '${match.name}' (${waitingCount > 0 ? waitingCount + ' units waiting' : 'high utilization'}).`,
          benefit: 'Warenstau sofort gelöst ohne Neukauf ($0 Investition)!'
        });
        if (suggestions.length >= 3) break;
      }
    }
    return suggestions;
  }

  // --- Company Finances & Treasury Rate Tracking ---
  const fin = data.finances || {};
  const stats = data.stats || null;
  lastCompanyStats = stats;

  let currentBankBalance = (typeof fin.bankBalance === 'number') ? fin.bankBalance : 0;
  let currentBankLoan = (typeof fin.loan === 'number') ? fin.loan : 0;
  let currentInterest = (typeof fin.interest === 'number' && fin.interest > 0)
    ? fin.interest
    : Math.round(currentBankLoan * 0.015);
  fin.interest = currentInterest;
  fin.interestPerMonth = Math.round(currentInterest / 12);
  fin.interestRate = fin.interestRate || 1.5;

  if (currentBankBalance !== 0 || treasuryHistory.length > 0) {
    treasuryHistory.push({
      time: now,
      gameDate: formattedCalendarDate || data.gameDate || '',
      gameTime: data.gameTime || 0,
      balance: currentBankBalance,
      loan: currentBankLoan,
      interest: currentInterest
    });
    if (treasuryHistory.length > HISTORY_MAX_POINTS) {
      treasuryHistory.shift();
    }
    persistHistoryToDisk();
  }

  // Process Stations / Warehouses
  let rawStations = (Array.isArray(data.stations) && data.stations.length > 0) ? data.stations : null;
  if (!rawStations || rawStations.length === 0) {
    const stMap = {};
    for (const l of processedLines) {
      const isPax = l.carrierCategory === 'ROAD_PERSON' || l.isOpnv;
      const towns = (l.towns && l.towns.length > 0) ? l.towns : [l.name];
      for (const t of towns) {
        const key = `${t} (${isPax ? 'Personen-Terminal' : 'Warenhaus / Güter'})`;
        if (!stMap[key]) {
          stMap[key] = {
            id: key,
            name: key,
            town: t,
            isPax,
            isCargo: !isPax,
            totalWaiting: 0,
            waitingPax: 0,
            waitingCargo: 0,
            lines: []
          };
        }
        if (!stMap[key].lines.includes(l.name)) stMap[key].lines.push(l.name);
        const share = Math.round((l.totalWaiting || 0) / Math.max(1, towns.length));
        if (isPax) stMap[key].waitingPax += share;
        else stMap[key].waitingCargo += share;
        stMap[key].totalWaiting += share;
      }
    }
    rawStations = Object.values(stMap).sort((a, b) => b.totalWaiting - a.totalWaiting);
  }
  const processedStations = rawStations.map(st => {
    if (!stationHistory[st.id]) stationHistory[st.id] = [];
    stationHistory[st.id].push({
      time: now,
      waiting: st.totalWaiting || 0,
      waitingPax: st.waitingPax || 0,
      waitingCargo: st.waitingCargo || 0
    });
    if (stationHistory[st.id].length > 60) stationHistory[st.id].shift();

    const hist = stationHistory[st.id];
    const avg5m = Math.round(hist.reduce((sum, h) => sum + h.waiting, 0) / hist.length);

    let status = 'OPTIMAL';
    let statusText = '⚖️ Normal ausgelastet';
    let statusLevel = 'good';

    if ((st.totalWaiting || 0) >= 40) {
      status = 'OVERFLOW';
      statusText = '🔴 ZU KLEIN (Warenstau!)';
      statusLevel = 'danger';
    } else if ((st.totalWaiting || 0) >= 15) {
      status = 'BUSY';
      statusText = '🟡 Hohe Auslastung';
      statusLevel = 'warn';
    } else if ((st.totalWaiting || 0) < 5) {
      status = 'UNDERUTILIZED';
      statusText = '🟢 ZU GROSS (Geringer Durchsatz)';
      statusLevel = 'muted';
    }

    return {
      id: st.id,
      name: st.name,
      town: st.town || '',
      isPax: st.isPax,
      isCargo: st.isCargo,
      liveWaiting: st.totalWaiting || 0,
      waitingPax: st.waitingPax || 0,
      waitingCargo: st.waitingCargo || 0,
      avgWaiting5m: avg5m,
      lines: st.lines || [],
      lineCount: (st.lines || []).length,
      status,
      statusText,
      statusLevel
    };
  });

  // Rate of Change Calculations (in $/minute)
  let balanceRatePerMin = 0;
  let balanceRate15s = 0;
  let balanceRate5m = 0;
  let trendState = 'STABLE'; // 'RISING', 'FALLING', 'STABLE'

  if (treasuryHistory.length > 1) {
    const pNow = treasuryHistory[treasuryHistory.length - 1];

    let pt15s = null;
    let pt60s = null;
    let pt5m = null;

    for (let i = treasuryHistory.length - 2; i >= 0; i--) {
      const dt = (now - treasuryHistory[i].time) / 1000;
      if (!pt15s && dt >= 15) pt15s = treasuryHistory[i];
      if (!pt60s && dt >= 60) pt60s = treasuryHistory[i];
      if (!pt5m && dt >= 300) { pt5m = treasuryHistory[i]; break; }
    }

    if (pt60s) {
      const dtMin = Math.max(0.2, (now - pt60s.time) / 60000);
      balanceRatePerMin = Math.round((pNow.balance - pt60s.balance) / dtMin);
    } else {
      const oldest = treasuryHistory[0];
      const dtMin = Math.max(0.1, (now - oldest.time) / 60000);
      balanceRatePerMin = Math.round((pNow.balance - oldest.balance) / dtMin);
    }

    if (pt15s) {
      const dtMin = Math.max(0.1, (now - pt15s.time) / 60000);
      balanceRate15s = Math.round((pNow.balance - pt15s.balance) / dtMin);
    }

    if (pt5m) {
      const dtMin = Math.max(1.0, (now - pt5m.time) / 60000);
      balanceRate5m = Math.round((pNow.balance - pt5m.balance) / dtMin);
    }

    if (balanceRatePerMin > 1000) trendState = 'RISING';
    else if (balanceRatePerMin < -1000) trendState = 'FALLING';
    else trendState = 'STABLE';
  }

  // Runway Estimation if burning money
  let runwayMinutes = null;
  if (balanceRatePerMin < 0 && currentBankBalance > 0) {
    runwayMinutes = Math.round(currentBankBalance / Math.abs(balanceRatePerMin));
  }

  // Financial Health Classification
  let healthState = 'EXCELLENT';
  if (balanceRatePerMin < -10000) {
    healthState = (runwayMinutes !== null && runwayMinutes < 20) ? 'CRITICAL' : 'BURN';
  } else if (balanceRatePerMin < -1000) {
    healthState = 'WARN';
  } else if (balanceRatePerMin >= 1000) {
    healthState = 'GROWING';
  } else {
    healthState = 'STABLE';
  }

  // AI Financial Advisory & Optimization Tips ("Was muss man ändern?")
  const financialAdvisory = [];

  const losingCount = topLosers.length;
  if (losingCount > 0) {
    const totalDeficitPerMin = topLosers.reduce((sum, l) => sum + Math.abs(l.cashflow60s), 0);
    financialAdvisory.push({
      type: 'DEFICIT_LINES',
      severity: losingCount >= 3 ? 'danger' : 'warn',
      icon: '📉',
      title: `${losingCount} Verlustbringer-Linien identifiziert`,
      description: `Diese Linien verbrennen zusammen ca. $${totalDeficitPerMin.toLocaleString()}/min. Prüfe Fahrzeuganzahl, Takte oder lege defizitäre Routen still.`,
      action: 'Zu den Verlustlinien wechseln'
    });
  }

  const penaltySum = processedLines.reduce((s, l) => s + (l.costPenalty || 0), 0);
  if (penaltySum > 20) {
    financialAdvisory.push({
      type: 'FLEET_MAINTENANCE',
      severity: penaltySum > 60 ? 'danger' : 'warn',
      icon: '🔧',
      title: `Flotten-Alterung erzeugt hohe Strafkosten`,
      description: `Deine Flotte erleidet im Schnitt ${Math.round(penaltySum / (processedLines.length || 1))}% Kostenstrafe durch Fahrzeugalterung. Tausche alte Fahrzeuge gegen sparsamere Neufahrzeuge aus.`,
      action: 'Flottenwartung optimieren'
    });
  }

  financialAdvisory.push({
    type: 'STATION_UPKEEP',
    severity: 'info',
    icon: '🏢',
    title: `Instandhaltung von Gebäuden & Stationen prüfen`,
    description: `Gebäude- und Stationsunterhalt läuft dauerhaft fix. Reiße ungenutzte Bahnsteige, Frachthallen oder Straßenmodule ab, um Fixkosten zu senken.`,
    action: 'Infrastruktur prüfen'
  });

  // In-Game Horizon Averaging Engine
  const validTreasury = treasuryHistory.filter(p => p && p.gameDate && typeof p.balance === 'number');
  let treasuryAverages = {
    all: { label: 'Gesamte Aufzeichnung', labelShort: 'Gesamt Ø', days: 1, years: 0.1, delta: 0, ratePerDay: 0, ratePerMonth: 0, ratePerYear: 0, ratePerMin: 0 },
    year: { label: 'Letztes Ingame-Jahr', labelShort: '1 Jahr Ø', days: 365, years: 1.0, delta: 0, ratePerDay: 0, ratePerMonth: 0, ratePerYear: 0, ratePerMin: 0 },
    month: { label: 'Letzter Ingame-Monat', labelShort: '1 Monat Ø', days: 30, years: 0.08, delta: 0, ratePerDay: 0, ratePerMonth: 0, ratePerYear: 0, ratePerMin: 0 },
    week: { label: 'Letzte Ingame-Woche', labelShort: '7 Tage Ø', days: 7, years: 0.02, delta: 0, ratePerDay: 0, ratePerMonth: 0, ratePerYear: 0, ratePerMin: 0 },
    live: { label: 'Live (60s)', labelShort: 'Live 60s', days: 0.1, delta: 0, ratePerDay: 0, ratePerMonth: 0, ratePerYear: 0, ratePerMin: balanceRatePerMin }
  };

  if (validTreasury.length > 1) {
    const getNetBal = p => (typeof p.balance === 'number' ? (p.balance - (p.loan || 0)) : 0);
    const pNow = validTreasury[validTreasury.length - 1];
    const nowDay = parseGameDateToDays(pNow.gameDate);
    const pFirst = validTreasury[0];
    const firstDay = parseGameDateToDays(pFirst.gameDate);

    // 1. All-time / Session Total (Operating Net Worth growth)
    const totalDays = Math.max(0.1, (nowDay !== null && firstDay !== null) ? (nowDay - firstDay) : 0.1);
    const totalDelta = getNetBal(pNow) - getNetBal(pFirst);
    const ratePerDayAll = Math.round(totalDelta / totalDays);
    const ratePerMonthAll = Math.round(ratePerDayAll * 30.4166);
    const ratePerYearAll = Math.round(ratePerDayAll * 365);
    const ratePerMinAll = realMinutesPerIngameDay > 0 ? Math.round(ratePerDayAll / realMinutesPerIngameDay) : 0;

    treasuryAverages.all = {
      label: 'Gesamte Aufzeichnung',
      labelShort: 'Gesamt Ø',
      days: Math.round(totalDays * 10) / 10,
      years: Math.round((totalDays / 365) * 10) / 10,
      startDate: pFirst.gameDate,
      endDate: pNow.gameDate,
      startBalance: pFirst.balance,
      endBalance: pNow.balance,
      startNet: getNetBal(pFirst),
      endNet: getNetBal(pNow),
      delta: totalDelta,
      ratePerDay: ratePerDayAll,
      ratePerMonth: ratePerMonthAll,
      ratePerYear: ratePerYearAll,
      ratePerMin: ratePerMinAll
    };

    // Helper for rolling in-game day windows
    function computeRollingIngameWindow(targetDays, label, labelShort) {
      if (nowDay === null) return null;
      let targetP = null;
      for (let i = validTreasury.length - 2; i >= 0; i--) {
        const d = parseGameDateToDays(validTreasury[i].gameDate);
        if (d !== null && (nowDay - d) >= targetDays) {
          targetP = validTreasury[i];
          break;
        }
      }
      if (!targetP) targetP = pFirst;
      const tDay = parseGameDateToDays(targetP.gameDate);
      const days = Math.max(0.1, (nowDay - (tDay !== null ? tDay : firstDay)));
      const delta = getNetBal(pNow) - getNetBal(targetP);
      const ratePerDay = Math.round(delta / days);
      return {
        label,
        labelShort,
        days: Math.round(days * 10) / 10,
        years: Math.round((days / 365) * 10) / 10,
        startDate: targetP.gameDate,
        endDate: pNow.gameDate,
        delta,
        ratePerDay,
        ratePerMonth: Math.round(ratePerDay * 30.4166),
        ratePerYear: Math.round(ratePerDay * 365),
        ratePerMin: realMinutesPerIngameDay > 0 ? Math.round(ratePerDay / realMinutesPerIngameDay) : 0
      };
    }

    treasuryAverages.year = computeRollingIngameWindow(365, 'Letztes Ingame-Jahr', '1 Jahr Ø') || treasuryAverages.all;
    treasuryAverages.month = computeRollingIngameWindow(30, 'Letzter Ingame-Monat', '1 Monat Ø') || treasuryAverages.all;
    treasuryAverages.week = computeRollingIngameWindow(7, 'Letzte Ingame-Woche', '7 Tage Ø') || treasuryAverages.month;

    // Live (60s)
    const ratePerMinLive = balanceRatePerMin;
    const ratePerDayLive = Math.round(ratePerMinLive * realMinutesPerIngameDay);
    treasuryAverages.live = {
      label: 'Live (60s)',
      labelShort: 'Live 60s',
      days: 0.1,
      years: 0.0,
      delta: Math.round(balanceRatePerMin),
      ratePerMin: ratePerMinLive,
      ratePerDay: ratePerDayLive,
      ratePerMonth: Math.round(ratePerDayLive * 30.4166),
      ratePerYear: Math.round(ratePerDayLive * 365)
    };
  }

  // Operational company-wide net cashflow per real minute (bank account delta rate)
  const companyRatePerMin = (typeof balanceRatePerMin === 'number' && balanceRatePerMin !== 0) ? balanceRatePerMin : totalCashflow60s;
  // Harmonized annualized in-game rate (matches player's annual in-game accounting ~3-6M/year)
  const annualizedNetRate = (treasuryAverages.all.ratePerYear !== 0)
    ? treasuryAverages.all.ratePerYear
    : ((fin.earningsYear && fin.earningsYear > 0) ? fin.earningsYear : Math.round(companyRatePerMin * realMinutesPerIngameYear));

  lastCompanyFinances = {
    bankBalance: currentBankBalance,
    loan: currentBankLoan,
    interest: currentInterest,
    interestPerMonth: fin.interestPerMonth || Math.round(currentInterest / 12),
    interestRate: fin.interestRate || 1.5,
    ratePerMin: companyRatePerMin,
    annualizedRate: annualizedNetRate,
    averages: treasuryAverages,
    rate15s: balanceRate15s,
    rate5m: balanceRate5m,
    trendState,
    healthState,
    runwayMinutes,
    earningsYear: fin.earningsYear || 0,
    tableYears: fin.tableYears || [],
    totalsByYear: fin.totalsByYear || [],
    balanceByYear: fin.balanceByYear || [],
    loanByYear: fin.loanByYear || [],
    interestByYear: fin.interestByYear || [],
    transport: fin.transport || {},
    investment: fin.investment || {},
    other: fin.other || {},
    advisory: financialAdvisory,
    history: treasuryHistory.slice(-1800), // Full 60 minutes of treasury history (1800 points @ 2s)
    historyTotalCount: treasuryHistory.length,
    historyEarliestTime: treasuryHistory.length ? treasuryHistory[0].time : now,
    historyLatestTime: treasuryHistory.length ? treasuryHistory[treasuryHistory.length - 1].time : now
  };

  latestPayload = {
    timestamp: now,
    gameDate: formattedCalendarDate,
    playDuration: playDurationStr,
    gameTime: data.gameTime || 0,
    simState: currentSimState,
    simSpeed: currentSimSpeed,
    isPaused: currentSimState === 'PAUSED',
    sessionElapsedMinutes: Math.round(sessionElapsedMin * 10) / 10,
    totalVehicles: data.totalVehicles || 0,
    totalLines: processedLines.length,
    overallUtilization: overallUtil,
    networkAverages,
    totalNetworkLoad,
    totalNetworkCap,
    totalNetworkWaiting,
    nettoPerMin: companyRatePerMin,
    annualizedNetRate: annualizedNetRate,
    treasuryAverages,
    totalCashflow60s,
    runningCostsPerMin,
    totalRunningCostsPerYear,
    topEarners,
    topLosers,
    problemLines,
    patternAlerts: patternAlerts.slice(0, 20),
    finances: lastCompanyFinances,
    companyStats: lastCompanyStats,
    networkProjections: {
      rate1m: companyRatePerMin,
      proj5m: companyRatePerMin * 5,
      proj10m: companyRatePerMin * 10,
      proj30m: companyRatePerMin * 30,
      proj1h: companyRatePerMin * 60,
      annualizedNetRate: annualizedNetRate,
      realMinutesPerIngameYear: Math.round(realMinutesPerIngameYear * 10) / 10,
      totalAnnualRunningCosts: totalRunningCostsPerYear
    },
    networkHistory: networkHistory.slice(-300),
    lines: processedLines,
    stations: processedStations,
    transferSuggestions: computeVehicleTransferSuggestions(processedLines),
    paxSummary: paxSummary,
    cargoSummary: cargoSummary
  };


  broadcast();
}

function broadcast(customMsg) {
  if (customMsg) {
    const msg = JSON.stringify(customMsg);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
    return;
  }
  if (!latestPayload) return;
  const msg = JSON.stringify({
    type: 'TELEMETRY_UPDATE',
    data: latestPayload,
    server: {
      lanIp: LAN_IP,
      port: PORT,
      tabletUrl: TABLET_URL,
      qrCode: qrCodeDataUrl,
      isLive: Date.now() - lastIngestTime < 6000
    }
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// Check process state
setInterval(() => {
  exec('tasklist /FI "IMAGENAME eq TransportFever3.exe" /FO CSV /NH', (err, stdout) => {
    processRunning = !err && stdout && stdout.includes('TransportFever3.exe');
  });
}, 3000);

// Ingestion loop: runs immediately and then every 1.5 seconds
ingestTelemetry();
setInterval(ingestTelemetry, 1500);

// REST APIs
app.get('/api/live', (req, res) => {
  if (!latestPayload) {
    return res.status(503).json({ error: 'No live telemetry received yet' });
  }
  res.json(latestPayload);
});

app.get('/api/finances', (req, res) => {
  res.json({
    finances: lastCompanyFinances,
    companyStats: lastCompanyStats,
    treasuryHistory: treasuryHistory.slice(-180)
  });
});

app.get('/api/line/:id/history', (req, res) => {
  const lid = parseInt(req.params.id, 10);
  const history = lineHistory[lid] || [];
  res.json({ id: lid, history });
});

// Network-level Multi-Horizon History for the Wall of Charts
app.get('/api/network/history', (req, res) => {
  const range = req.query.range || 'all'; // 1m, 5m, 15m, 30m, 1h, all
  const now = Date.now();
  let msLimit = 3600000;
  if (range === '1m') msLimit = 60000;
  else if (range === '5m') msLimit = 300000;
  else if (range === '15m') msLimit = 900000;
  else if (range === '30m') msLimit = 1800000;
  else if (range === '1h') msLimit = 3600000;
  else msLimit = Infinity;

  const filtered = networkHistory.filter(pt => (now - pt.time) <= msLimit);
  res.json({ range, count: filtered.length, history: filtered });
});

// Compare multiple lines simultaneously
app.get('/api/compare', (req, res) => {
  const idsStr = req.query.ids || '';
  const ids = idsStr.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
  const results = {};
  for (const id of ids) {
    results[id] = lineHistory[id] || [];
  }
  res.json({ ids, histories: results });
});

app.get('/api/state', (req, res) => {
  if (!latestPayload) {
    return res.status(503).json({ error: 'No telemetry ingested yet' });
  }
  res.json(latestPayload);
});

app.get('/api/stations', (req, res) => {
  if (!latestPayload) return res.status(503).json({ error: 'No data' });
  res.json({ stations: latestPayload.stations || [] });
});

app.get('/api/transfers', (req, res) => {
  if (!latestPayload) return res.status(503).json({ error: 'No data' });
  res.json({ suggestions: latestPayload.transferSuggestions || [] });
});

app.get('/api/finances/history', (req, res) => {
  const range = req.query.range || 'all'; // 5m, 15m, 30m, 1h, all
  const now = Date.now();
  let ms = Infinity;
  if (range === '5m') ms = 300000;
  else if (range === '15m') ms = 900000;
  else if (range === '30m') ms = 1800000;
  else if (range === '1h') ms = 3600000;
  const filtered = (ms === Infinity) ? treasuryHistory : treasuryHistory.filter(pt => (now - pt.time) <= ms);
  res.json({
    range,
    count: filtered.length,
    totalCount: treasuryHistory.length,
    earliestTime: treasuryHistory.length ? treasuryHistory[0].time : now,
    latestTime: treasuryHistory.length ? treasuryHistory[treasuryHistory.length - 1].time : now,
    history: filtered
  });
});

app.get('/api/status', (req, res) => {
  const isEngineLive = Date.now() - lastIngestTime < 6000;
  res.json({
    online: true,
    isEngineLive,
    simState: isEngineLive ? currentSimState : 'OFFLINE',
    simSpeed: isEngineLive ? currentSimSpeed : 0,
    lastIngestTime,
    processRunning,
    lanIp: LAN_IP,
    port: PORT,
    tabletUrl: TABLET_URL,
    qrCode: qrCodeDataUrl
  });
});

app.post('/api/reset', (req, res) => {
  resetSession();
  res.json({ success: true, message: 'Session data reset successfully' });
});

app.get('/api/calibration/date', (req, res) => {
  res.json({
    dateConfig,
    currentDate: formatGameCalendarDate(latestPayload ? latestPayload.gameTime : 0),
    currentGameTime: latestPayload ? latestPayload.gameTime : 0
  });
});

app.post('/api/calibration/date', (req, res) => {
  const { anchorDate, speedFactor, isPaused, syncWithCurrentTime } = req.body || {};
  if (anchorDate && typeof anchorDate === 'string') {
    dateConfig.anchorDate = anchorDate.trim();
  }
  if (typeof speedFactor === 'number' && speedFactor >= 0) {
    dateConfig.speedFactor = speedFactor;
  }
  if (typeof isPaused === 'boolean') {
    dateConfig.isPaused = isPaused;
  }
  if (syncWithCurrentTime !== false && latestPayload && latestPayload.gameTime) {
    dateConfig.anchorGameTime = latestPayload.gameTime;
  }
  saveDateConfig();
  console.log(`[TF3 Dashboard] Calendar synchronized: anchorDate=${dateConfig.anchorDate}, anchorGameTime=${dateConfig.anchorGameTime}, speedFactor=${dateConfig.speedFactor}`);
  res.json({
    success: true,
    dateConfig,
    currentDate: formatGameCalendarDate(latestPayload ? latestPayload.gameTime : 0)
  });
});

app.get('/api/export/csv', (req, res) => {
  if (!latestPayload || !latestPayload.lines) {
    return res.status(503).send('No data');
  }
  const headers = ['ID', 'Name', 'Carrier', 'CargoType', 'Vehicles', 'Stops', 'Capacity', 'Load_Live', 'Load_60s', 'Util_60s', 'Maintenance_Pct', 'Penalty_Pct', 'Age_Years', 'Waiting', 'Speed_kmh', 'Cashflow_60s_PerMin', 'Proj_5m', 'Proj_1h', 'Pattern', 'Recommendation', 'Annual_Costs', 'Status'];
  const rows = latestPayload.lines.map(l => [
    l.id,
    `"${l.name}"`,
    l.carrierCategory,
    `"${l.cargoType || 'Diverse'}"`,
    l.vehicleCount,
    l.stopCount,
    l.capacity,
    l.load,
    l.avgLoad60s,
    l.avgUtil60s,
    l.maintState,
    l.costPenalty,
    l.avgAgeYears,
    l.totalWaiting,
    l.avgSpeed60s,
    l.cashflow60s,
    l.proj5m,
    l.proj1h,
    `"${l.patternTag || 'STABLE'}"`,
    `"${l.recommendation || ''}"`,
    l.runningCosts,
    `"${l.statusText}"`
  ]);
  const csv = [headers.join(';')].concat(rows.map(r => r.join(';'))).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tf3_telemetry_export.csv"');
  res.send('\uFEFF' + csv);
});

server.listen(PORT, HOST, () => {
  console.log(`\n===========================================================`);
  console.log(`🚀 TRANSPORT FEVER 3 — LIVE TELEMETRIE & ANALYTICS DASHBOARD`);
  console.log(`===========================================================`);
  console.log(`📡 Localhost:     http://localhost:${PORT}`);
  console.log(`📱 LAN / Tablet:  ${TABLET_URL}`);
  console.log(`⚡ Engine Stream: Connected directly to TF3 In-Game Lua`);
  console.log(`===========================================================\n`);
});
