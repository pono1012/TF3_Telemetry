#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TF3 Live Telemetry & Data Mining Suite
Echtzeit-Tracking von Linien, Fahrzeugen, Auslastung, Saldo-Akkumulation,
Geld pro Minute ($/min) und Einweg-/Routen-Nutzungs-Analyse.
Sortierung nach Cargo-Typ & Kategorisierung in:
- Cargo (Road)
- Passenger (Road)
- Schiene (Rail)
- Wasser (Water)
- Luft (Air)
Inklusive persistenter SQLite-Datenbank und interaktivem Reset-Knopf ('r').
"""

import os
import sys
import time
import json
import glob
import re
import struct
import sqlite3
from datetime import datetime

# Windows non-blocking keyboard input
try:
    import msvcrt
    HAS_MSVCRT = True
except ImportError:
    HAS_MSVCRT = False

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
LIVE_JSON = os.path.join(PROJECT_DIR, "live_telemetry.json")
DB_PATH = os.path.join(PROJECT_DIR, "telemetry_data.sqlite")
RESET_FLAG = os.path.join(PROJECT_DIR, "reset.flag")

def find_stdout_path():
    env_path = os.environ.get('TF3_STDOUT_PATH')
    if env_path and os.path.exists(env_path):
        return env_path

    candidates = []
    appdata = os.environ.get('APPDATA')
    if appdata:
        gse_dir = os.path.join(appdata, 'GSE Saves')
        if os.path.isdir(gse_dir):
            try:
                for sub in os.listdir(gse_dir):
                    candidates.append(os.path.join(gse_dir, sub, 'local', 'crash_dump', 'stdout.txt'))
            except Exception:
                pass
        candidates.append(os.path.join(appdata, 'Transport Fever 3', 'crash_dump', 'stdout.txt'))
        candidates.append(os.path.join(appdata, 'Transport Fever 2', 'crash_dump', 'stdout.txt'))

    for drive in ['C:', 'D:', 'E:']:
        steam_dir = os.path.join(f"{drive}\\", "Program Files (x86)", "Steam", "userdata")
        if os.path.isdir(steam_dir):
            try:
                for u in os.listdir(steam_dir):
                    candidates.append(os.path.join(steam_dir, u, '1066780', 'local', 'crash_dump', 'stdout.txt'))
            except Exception:
                pass

    userprofile = os.environ.get('USERPROFILE')
    if userprofile:
        candidates.append(os.path.join(userprofile, 'Documents', 'Urban Games', 'Transport Fever 2', 'crash_dump', 'stdout.txt'))
        candidates.append(os.path.join(userprofile, 'Documents', 'Urban Games', 'Transport Fever 3', 'crash_dump', 'stdout.txt'))

    candidates.append(os.path.join(PROJECT_DIR, 'stdout.txt'))

    for c in candidates:
        if os.path.exists(c):
            return c
    return candidates[0] if candidates else os.path.join(PROJECT_DIR, 'stdout.txt')

STDOUT_PATH = find_stdout_path()

# ANSI Colors
CLR_RESET = "\033[0m"
CLR_BOLD = "\033[1m"
CLR_RED = "\033[91m"
CLR_GREEN = "\033[92m"
CLR_YELLOW = "\033[93m"
CLR_BLUE = "\033[94m"
CLR_CYAN = "\033[96m"
CLR_WHITE = "\033[97m"
CLR_GRAY = "\033[90m"
CLR_MAGENTA = "\033[95m"

# -------------------------------------------------------------
# DATABASE INITIALIZATION (WAL MODE FOR MAXIMUM SPEED)
# -------------------------------------------------------------
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL;")
    cur.execute("PRAGMA synchronous=NORMAL;")
    
    cur.execute("CREATE TABLE IF NOT EXISTS telemetry_ticks ("
                "id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp REAL, datetime_iso TEXT, "
                "game_time INTEGER, game_date TEXT, total_vehicles INTEGER, total_lines INTEGER);")
    
    cur.execute("CREATE TABLE IF NOT EXISTS line_telemetry ("
                "id INTEGER PRIMARY KEY AUTOINCREMENT, tick_id INTEGER, timestamp REAL, "
                "datetime_iso TEXT, game_date TEXT, line_id INTEGER, line_name TEXT, "
                "carrier TEXT, cargo_type TEXT, is_opnv INTEGER, vehicle_count INTEGER, "
                "load INTEGER, capacity INTEGER, utilization INTEGER, rate INTEGER, "
                "frequency INTEGER, satisfaction INTEGER, cashflow INTEGER, "
                "running_cost INTEGER, loaded_vehicles INTEGER, empty_vehicles INTEGER, "
                "directional_ratio REAL);")
    
    cur.execute("PRAGMA table_info(line_telemetry);")
    cols = [r[1] for r in cur.fetchall()]
    if cols and "carrier" not in cols:
        try: cur.execute("ALTER TABLE line_telemetry ADD COLUMN carrier TEXT;")
        except: pass
    if cols and "cargo_type" not in cols:
        try: cur.execute("ALTER TABLE line_telemetry ADD COLUMN cargo_type TEXT;")
        except: pass
    if cols and "maint_state" not in cols:
        try: cur.execute("ALTER TABLE line_telemetry ADD COLUMN maint_state INTEGER;")
        except: pass
    if cols and "cost_penalty" not in cols:
        try: cur.execute("ALTER TABLE line_telemetry ADD COLUMN cost_penalty INTEGER;")
        except: pass
    if cols and "avg_age" not in cols:
        try: cur.execute("ALTER TABLE line_telemetry ADD COLUMN avg_age REAL;")
        except: pass
    if cols and "station_overflow" not in cols:
        try: cur.execute("ALTER TABLE line_telemetry ADD COLUMN station_overflow INTEGER;")
        except: pass

    cur.execute("CREATE INDEX IF NOT EXISTS idx_line_time ON line_telemetry(line_id, timestamp);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_line_name ON line_telemetry(line_name);")
    try:
        cur.execute("CREATE INDEX IF NOT EXISTS idx_carrier_cargo ON line_telemetry(carrier, cargo_type);")
    except:
        pass
    conn.commit()
    conn.close()

init_db()

# -------------------------------------------------------------
# SESSION IN-MEMORY DATA MINING STATE
# -------------------------------------------------------------
session_start_time = time.time()
line_stats = {}  # line_id -> dict with accumulated stats

def reset_session():
    global session_start_time, line_stats
    session_start_time = time.time()
    line_stats = {}
    if os.path.exists(RESET_FLAG):
        try: os.remove(RESET_FLAG)
        except: pass

def render_bar(load, capacity, width=5):
    if capacity <= 0:
        return f"[{'░' * width}]"
    ratio = min(1.0, max(0.0, load / capacity))
    filled = int(round(ratio * width))
    bar = "█" * filled + "░" * (width - filled)
    if ratio == 0:
        return f"{CLR_RED}[{bar}]{CLR_RESET}"
    elif ratio < 0.25:
        return f"{CLR_YELLOW}[{bar}]{CLR_RESET}"
    elif ratio >= 0.75:
        return f"{CLR_GREEN}[{bar}]{CLR_RESET}"
    return f"{CLR_CYAN}[{bar}]{CLR_RESET}"

def format_freq(s):
    if not s or s <= 0: return "-"
    if s < 150:
        return f"{s}s"
    m = s // 60
    rem = s % 60
    return f"{m}m{rem:02d}s" if rem > 0 else f"{m}m"

def format_rate(r):
    if not r or r <= 0: return "-"
    return f"{r}/J"

def format_money(val):
    if val is None or val == 0: return "$0"
    sign = "+" if val > 0 else "-"
    av = abs(val)
    if av >= 10_000_000:
        return f"{sign}${av/1_000_000:.1f}M"
    elif av >= 1_000_000:
        return f"{sign}${av/1_000_000:.2f}M"
    elif av >= 100_000:
        return f"{sign}${av/1_000:.0f}k"
    elif av >= 1_000:
        return f"{sign}${av/1_000:.1f}k"
    return f"{sign}${av}"

def format_money_rate(val_per_min):
    if not val_per_min or abs(val_per_min) < 1: return "$0/m"
    sign = "+" if val_per_min > 0 else "-"
    av = abs(val_per_min)
    if av >= 1_000_000:
        return f"{sign}${av/1_000_000:.2f}M/m"
    elif av >= 10_000:
        return f"{sign}${av/1_000:.0f}k/m"
    elif av >= 1_000:
        return f"{sign}${av/1_000:.1f}k/m"
    return f"{sign}${av:.0f}/m"

def format_sat(sat):
    if not sat or sat <= 0: return "-"
    if sat >= 75:
        return f"{CLR_GREEN}{sat}%{CLR_RESET}"
    elif sat >= 40:
        return f"{CLR_YELLOW}{sat}%{CLR_RESET}"
    return f"{CLR_RED}{sat}%{CLR_RESET}"

def format_route_usage(loaded, total, ratio):
    """
    Routen-Nutzung: Erkennt, ob Fahrzeuge nur in eine Richtung voll sind (Einweg 50%),
    voll ausgelastet sind (Zweiweg) oder leer fahren.
    """
    if total <= 0: return "-"
    if loaded == 0:
        return f"{CLR_RED}0% Leer{CLR_RESET}"
    pct = int(round(ratio * 100))
    if 40 <= pct <= 60:
        return f"{CLR_YELLOW}50% (1-Weg){CLR_RESET}"
    elif pct > 75:
        return f"{CLR_GREEN}{pct}% (2-Weg){CLR_RESET}"
    return f"{CLR_CYAN}{pct}%{CLR_RESET}"

# -------------------------------------------------------------
# INTELLIGENT CARRIER & CARGO CLASSIFICATION
# Standardisierte Transportcodes und Engine-Erkennung
# -------------------------------------------------------------
CARGO_EMOJIS = {
    "Kohle": "🪨 Kohle",
    "Weizen": "🌾 Weizen",
    "Fleisch": "🥩 Fleisch",
    "Holz": "🪵 Holz",
    "Öl": "🛢️ Öl",
    "Treibstoff": "⛽ Treibstoff",
    "Stahl": "🔩 Stahl",
    "Steine": "🪨 Steine",
    "Eisenerz": "⛏️ Eisenerz",
    "Waren": "📦 Waren",
    "Lebensmittel": "🍞 Lebensm.",
    "Kunststoff": "🧪 Kunststoff",
    "Passagiere": "👥 Passagiere",
    "Diverse": "📦 Diverse"
}

def classify_line(line_name, vehicles=None, engine_carrier=None):
    nl = line_name.strip()
    nl_upper = nl.upper()
    
    # 1. High Priority: Explicit Transport Code Prefixes (RC, TR, etc.)
    # RC = Road Cargo (LKW), TR = Truck
    if nl_upper.startswith("RC ") or nl_upper.startswith("TR "):
        return "ROAD_CARGO"
    # Bus = Road Passenger, ÖPNV / PNV
    if nl_upper.startswith("BUS ") or "ÖPNV" in nl_upper or "PNV" in nl_upper:
        return "ROAD_PERSON"
    # TC = Train Cargo, TP = Train Passenger, TRN = Train
    if nl_upper.startswith("TC ") or nl_upper.startswith("TP ") or nl_upper.startswith("TRN "):
        return "RAIL"
    # WC = Water Cargo, WP = Water Passenger, SH = Ship
    if nl_upper.startswith("WC ") or nl_upper.startswith("WP ") or nl_upper.startswith("SH "):
        return "WATER"
    # AC = Air Cargo, AP = Air Passenger, HC = Heli Cargo, HE = Heli Passenger
    if nl_upper.startswith("AC ") or nl_upper.startswith("AP ") or nl_upper.startswith("HC ") or nl_upper.startswith("HE "):
        return "AIR"

    # 2. Check Vehicle names
    v_names = " ".join([v.get('name', '') for v in (vehicles or [])]).lower()
    if "ship" in v_names or "boot" in v_names or "schiff" in v_names:
        return "WATER"
    if "train" in v_names or "zug" in v_names or "lok" in v_names:
        return "RAIL"
    if "plane" in v_names or "heli" in v_names or "aircraft" in v_names:
        return "AIR"

    # 3. Engine carrier if valid (and not defaulted)
    if engine_carrier and engine_carrier in ["ROAD_CARGO", "ROAD_PERSON", "RAIL", "WATER", "AIR"]:
        if engine_carrier != "RAIL":  # Guard against vehicle trailer misclassification
            return engine_carrier

    # 4. Fallback Keywords in line name
    if "cargo" in nl.lower():
        return "ROAD_CARGO"
    if "passengers" in nl.lower():
        return "ROAD_PERSON"

    return "ROAD_CARGO"

def read_live_telemetry():
    # 1. Direct JSON file
    if os.path.exists(LIVE_JSON):
        if time.time() - os.path.getmtime(LIVE_JSON) < 10:
            try:
                with open(LIVE_JSON, 'r', encoding='utf-8') as f:
                    d = json.load(f)
                d['source'] = 'IN-GAME LUA ENGINE (LIVE 1Hz)'
                d['isLive'] = True
                return d
            except:
                pass

    # 2. Check stdout.txt stream
    if os.path.exists(STDOUT_PATH):
        try:
            with open(STDOUT_PATH, 'rb') as f:
                f.seek(max(0, os.path.getsize(STDOUT_PATH) - 150000))
                tail = f.read().decode('utf-8', errors='ignore')
            matches = list(re.finditer(r'\[TF3_LIVE_TELEMETRY\](.*)', tail))
            if matches:
                last_json_str = matches[-1].group(1).strip()
                d = json.loads(last_json_str)
                d['source'] = 'IN-GAME LUA LOG STREAM (LIVE 1Hz)'
                d['isLive'] = True
                return d
        except:
            pass

    return None

def store_telemetry_batch(data):
    """Speichert einen vollständigen Telemetrie-Tick in die SQLite-Datenbank."""
    now_ts = time.time()
    dt_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    g_time = data.get('gameTime', 0)
    g_date = data.get('gameDate', '')
    lines = data.get('lines', [])

    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO telemetry_ticks (timestamp, datetime_iso, game_time, game_date, total_vehicles, total_lines)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (now_ts, dt_iso, g_time, g_date, data.get('totalVehicles', 0), len(lines)))
        tick_id = cur.lastrowid

        rows = []
        for l in lines:
            rows.append((
                tick_id,
                now_ts,
                dt_iso,
                g_date,
                l.get('id', 0),
                l.get('name', ''),
                l.get('carrier_category', 'ROAD_CARGO'),
                l.get('cargo_clean', 'Diverse'),
                1 if l.get('isOpnv') else 0,
                l.get('vehicleCount', 0),
                l.get('load', 0),
                l.get('capacity', 0),
                l.get('utilization', 0),
                l.get('rate', 0),
                l.get('frequency', 0),
                l.get('satisfaction', 0),
                l.get('cashflow', 0),
                l.get('runningCosts', 0),
                l.get('loadedVehicles', 0),
                l.get('emptyVehicles', 0),
                l.get('directionalRatio', 0.0),
                l.get('maintState', 100),
                l.get('costPenalty', 0),
                l.get('avgAgeYears', 0.0),
                l.get('stationOverflow', 0)
            ))

        cur.executemany("""
            INSERT INTO line_telemetry (
                tick_id, timestamp, datetime_iso, game_date, line_id, line_name, carrier, cargo_type, is_opnv,
                vehicle_count, load, capacity, utilization, rate, frequency, satisfaction,
                cashflow, running_cost, loaded_vehicles, empty_vehicles, directional_ratio,
                maint_state, cost_penalty, avg_age, station_overflow
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, rows)

        conn.commit()
        conn.close()
    except Exception as e:
        pass

def update_line_metrics(lines):
    """
    Data Mining Aggregation & Klassifikation:
    Akkumuliert den Saldo über die Zeit, berechnet Geld pro Minute ($/min),
    klassifiziert nach Carrier und sortiert nach Cargo-Typ.
    """
    now = time.time()
    elapsed_min = max(0.05, (now - session_start_time) / 60.0)

    for l in lines:
        lid = l.get('id', 0)
        cf = l.get('cashflow', 0)
        ann_bal = l.get('annualBalance', 0)

        # 1. Classify Carrier
        carrier = classify_line(
            l.get('name', ''),
            l.get('vehicles'),
            l.get('carrier')
        )
        l['carrier_category'] = carrier

        # 2. Accumulated Cashflow
        if lid not in line_stats:
            line_stats[lid] = {
                'accumulated_balance': 0,
                'cashflow_history': []
            }

        st = line_stats[lid]
        if cf != 0:
            st['accumulated_balance'] += cf
            st['cashflow_history'].append((now, cf))

        st['cashflow_history'] = [(t, v) for t, v in st['cashflow_history'] if now - t <= 60]
        recent_60s_cf = sum(v for t, v in st['cashflow_history'])

        l['session_balance'] = st['accumulated_balance']
        l['annual_balance'] = ann_bal
        l['money_per_min'] = st['accumulated_balance'] / elapsed_min
        l['recent_60s_per_min'] = recent_60s_cf

def check_user_input():
    """Prüft auf Tastendruck 'r' (Reset) ohne das Terminal zu blockieren."""
    if os.path.exists(RESET_FLAG):
        reset_session()
        return True

    if HAS_MSVCRT and msvcrt.kbhit():
        ch = msvcrt.getch()
        try:
            char = ch.decode('utf-8', errors='ignore').lower()
            if char == 'r':
                reset_session()
                return True
        except:
            pass
    return False

def render_category_table(title, icon, color, lines):
    if not lines:
        return

    # Sort strictly alphabetically by name
    lines.sort(key=lambda x: x.get('name', '').lower())

    print(f"\n{CLR_BOLD}{color}─── {icon} {title.upper()} ({len(lines)} Linien) ────────────────────────────────────────────────────────────────────────────────────────────{CLR_RESET}")
    print(f" {'Linienname':<34} | {'Fzg':<3} | {'Load/Cap':<9} | {'Auslastung':<11} | {'Routen-Weg':<13} | {'Takt':<6} | {'Rate':<6} | {'Saldo (Sess)':<11} | {'$/Min':<9} | {'Zufried':<7}")
    print(" " + "─" * 128)
    for l in lines:
        v_cnt = l.get('vehicleCount', 0)
        tot_l = l.get('load', 0)
        tot_c = l.get('capacity', 0)
        pct = l.get('utilization', 0)
        bar = render_bar(tot_l, tot_c, width=5)
        
        freq_str = format_freq(l.get('frequency'))
        rate_str = format_rate(l.get('rate'))
        
        sess_bal = l.get('session_balance', 0)
        bal_str = format_money(sess_bal)
        if l.get('annual_balance', 0) != 0:
            bal_str = format_money(l.get('annual_balance'))
            
        rate_m_str = format_money_rate(l.get('money_per_min', 0))
        sat_str = format_sat(l.get('satisfaction'))
        
        loaded = l.get('loadedVehicles', 0)
        ratio = l.get('directionalRatio', 0.0)
        route_str = format_route_usage(loaded, v_cnt, ratio)

        print(f" {l['name'][:34]:<34} | {v_cnt:2d}  | {tot_l:>3}/{tot_c:<4} | {bar} {pct:3d}% | {route_str:<21} | {freq_str:<6} | {rate_str:<6} | {bal_str:<11} | {rate_m_str:<9} | {sat_str:<7}")

def print_dashboard(data):
    lines = data.get('lines', [])

    # Group into the 5 distinct categories
    road_cargo = [l for l in lines if l.get('carrier_category') == 'ROAD_CARGO']
    road_person = [l for l in lines if l.get('carrier_category') == 'ROAD_PERSON']
    rail_lines = [l for l in lines if l.get('carrier_category') == 'RAIL']
    water_lines = [l for l in lines if l.get('carrier_category') == 'WATER']
    air_lines = [l for l in lines if l.get('carrier_category') == 'AIR']

    now_str = time.strftime('%H:%M:%S')
    game_date_str = data.get('gameDate') or "Laufend"
    elapsed_sec = int(time.time() - session_start_time)
    elapsed_str = f"{elapsed_sec // 60}m {elapsed_sec % 60:02d}s"

    os.system('cls' if os.name == 'nt' else 'clear')

    print("╔" + "═" * 126 + "╗")
    print(f"║ {CLR_BOLD}{CLR_CYAN}TRANSPORT FEVER 3 — TELEMETRIE & DATAMINING SUITE{CLR_RESET}          Datum: {game_date_str:<18} Stand: {now_str}   ║")
    print(f"║ Tracking-Dauer: {CLR_YELLOW}{elapsed_str:<10}{CLR_RESET} [Taste {CLR_BOLD}'r'{CLR_RESET} drücken = Saldo-Reset]        DB: {os.path.basename(DB_PATH):<25}   ║")
    print("╚" + "═" * 126 + "╝")

    # Render each distinct category separately
    render_category_table("GÜTER & LKW (Road Cargo)", "🚚", CLR_CYAN, road_cargo)
    render_category_table("ÖPNV & BUSSE (Road Passenger)", "🚌", CLR_GREEN, road_person)
    render_category_table("SCHIENE & ZÜGE (Rail)", "🚆", CLR_YELLOW, rail_lines)
    render_category_table("WASSER & SCHIFFE (Water)", "🚢", CLR_BLUE, water_lines)
    render_category_table("LUFT & FLUGZEUGE (Air)", "✈️", CLR_MAGENTA, air_lines)

    print("\n" + "─" * 128)
    print(f" {CLR_BOLD}💡 HINWEISE:{CLR_RESET}")
    print(f" • {CLR_BOLD}Kategorien & Sortierung{CLR_RESET}: Alle 5 Sparten sind sauber untereinander getrennt und {CLR_CYAN}alphabetisch nach Namen{CLR_RESET} sortiert.")
    print(f" • {CLR_BOLD}'Routen-Weg'{CLR_RESET}: Erkennt z. B. {CLR_YELLOW}50% (1-Weg){CLR_RESET} für Pendel-Güterverkehr (voll hin, leer zurück) vs. {CLR_GREEN}2-Weg{CLR_RESET}.")
    print(f" • {CLR_BOLD}'Saldo (Sess)' & '$/Min'{CLR_RESET}: Erfasst jede Einnahme & Fahrzeug-Wartung sekündlich live in SQLite.")
    print(f" • Drücke im Terminal jederzeit {CLR_BOLD}{CLR_CYAN}'r'{CLR_RESET} zum Zurücksetzen der Zähler für einen neuen Messzeitraum.")


def main():
    print("Starte TF3 Telemetrie & Data Mining Suite...")
    print(f"Datenbank: {DB_PATH}")
    last_update = 0

    while True:
        try:
            # Check for reset keypress 'r'
            if check_user_input():
                print(f"\n{CLR_GREEN}>> SESSION ZÄHLER ERFOLGREICH ZURÜCKGESETZT! <<{CLR_RESET}")
                time.sleep(0.5)

            data = read_live_telemetry()
            if data and data.get('lines'):
                t = data.get('timestamp', 0)
                if t != last_update:
                    last_update = t
                    update_line_metrics(data['lines'])
                    store_telemetry_batch(data)
                    print_dashboard(data)

            time.sleep(1.0)
        except KeyboardInterrupt:
            print("\nMonitor beendet.")
            break
        except Exception as e:
            time.sleep(1.0)

if __name__ == '__main__':
    main()
