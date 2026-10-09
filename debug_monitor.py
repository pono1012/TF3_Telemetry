#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TF3 Deep Telemetry Debug Suite & 1-Minuten Prüfstand
Umfassendes Echtzeit-Tracking aller verifizierten Engine-Metriken:
- Fzg, Haltestellen (Stops) & Flottenkapazität
- Live-Load vs. 1-Minuten Durchschnitt
- Live-Auslastung vs. 1-Minuten Durchschnitt (Balken & %)
- Wartende Fracht / Passagiere an allen Stationen (Backlog)
- Geschwindigkeit in km/h & automatische Stau-Erkennung
- Flotten-Jahreskosten (Running Costs) & Fahrzeug-Restwert (Fleet Value)
- Routen-Weg (1-Weg 50% vs. 2-Weg Fracht)
- Takt, Rate & Zufriedenheit
- Reale 1-Minuten-Netto-Einnahmen ($/Min)
- Engine Line Issues & Warnungen
"""

import os
import sys
import time
import json
from collections import deque

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import live_monitor

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

# 60-Sekunden Sliding Window: line_id -> deque of (timestamp, load, util, dir_ratio, cf, speed)
history_60s = {}
start_time = time.time()

def update_60s_averages(line):
    lid = line.get('id', 0)
    now = time.time()
    
    if lid not in history_60s:
        history_60s[lid] = deque()
        
    buf = history_60s[lid]
    
    cur_load = line.get('load', 0)
    cur_util = line.get('utilization', 0)
    dir_ratio = line.get('directionalRatio', 0.0)
    cf = line.get('cashflow', 0)
    spd = line.get('avgSpeed', 0)
    
    buf.append((now, cur_load, cur_util, dir_ratio, cf, spd))
    
    # Älter als 60 Sekunden entfernen
    while buf and (now - buf[0][0] > 60.0):
        buf.popleft()
        
    samples = len(buf)
    if samples > 0:
        avg_l = sum(item[1] for item in buf) / samples
        avg_u = sum(item[2] for item in buf) / samples
        avg_dir = sum(item[3] for item in buf) / samples
        sum_cf = sum(item[4] for item in buf)
        avg_spd = sum(item[5] for item in buf) / samples
    else:
        avg_l, avg_u, avg_dir, sum_cf, avg_spd = cur_load, cur_util, dir_ratio, cf, spd
        
    line['avg_load_60s'] = round(avg_l, 1)
    line['avg_util_60s'] = int(round(avg_u))
    line['avg_dir_60s'] = avg_dir
    line['cashflow_60s'] = sum_cf
    line['avg_speed_60s'] = int(round(avg_spd))
    line['samples_count'] = samples

import re

ANSI_REGEX = re.compile(r'\x1b\[[0-9;]*m')

def strip_ansi(text):
    return ANSI_REGEX.sub('', str(text))

def pad(text, width, align='left'):
    s = str(text)
    v_len = len(strip_ansi(s))
    p = max(0, width - v_len)
    if align == 'right':
        return (' ' * p) + s
    return s + (' ' * p)

def format_maint(maint_pct, penalty_pct):
    if maint_pct is None:
        return f"{CLR_GRAY}  -   {CLR_RESET}"
    p_str = f"+{penalty_pct}%" if penalty_pct > 0 else "+0%"
    if maint_pct >= 75:
        return f"{CLR_GREEN}{maint_pct:>2}%{CLR_RESET} ({CLR_GRAY}{p_str:<4}{CLR_RESET})"
    elif maint_pct >= 50:
        return f"{CLR_CYAN}{maint_pct:>2}%{CLR_RESET} ({CLR_YELLOW}{p_str:<4}{CLR_RESET})"
    elif maint_pct >= 25:
        return f"{CLR_YELLOW}{maint_pct:>2}%{CLR_RESET} ({CLR_RED}{p_str:<4}{CLR_RESET})"
    return f"{CLR_RED}{maint_pct:>2}%{CLR_RESET} ({CLR_RED}{p_str:<4}{CLR_RESET})"

def format_age(age_years, formatted_age):
    if formatted_age and len(formatted_age) > 0:
        fa = formatted_age.replace("Jahre", "J").replace("Jahr", "J").replace("Monate", "Mo").replace("Monat", "Mo").strip()
        return f"{fa:<5}"
    if age_years and age_years > 0:
        if age_years < 1.0:
            mo = max(1, int(round(age_years * 12)))
            return f"{mo} Mo"
        return f"{age_years:.1f} J"
    return f"{CLR_GRAY} -  {CLR_RESET}"

def format_overflow(cnt):
    if not cnt or cnt <= 0:
        return f"{CLR_GRAY}  - {CLR_RESET}"
    return f"{CLR_RED}⚠️{cnt:>2}{CLR_RESET}"

def format_per_vehicle(money_val, v_count):
    if not v_count or v_count <= 0 or not money_val:
        return f"{CLR_GRAY}   $0{CLR_RESET}"
    per_v = money_val / v_count
    return live_monitor.format_money(int(round(per_v)))

def render_category_debug(title, icon, color, lines):
    if not lines:
        return

    # Alphabetische Sortierung nach Linienname
    lines.sort(key=lambda x: x.get('name', '').lower())

    headers = [
        pad("Linienname", 26),
        pad("Fzg", 3, 'right'),
        pad("Stp", 3, 'right'),
        pad("Cap", 4, 'right'),
        pad("Load Live/1m", 11, 'right'),
        pad("Auslastung 1m", 14),
        pad("Zustand (Strafe)", 16),
        pad("Alter", 5),
        pad("Wartend", 7, 'right'),
        pad("Überl", 5, 'right'),
        pad("Speed", 8, 'right'),
        pad("1m-Saldo", 9, 'right'),
        pad("$/Fzg", 7, 'right'),
        pad("Takt", 5, 'right'),
        pad("Rate", 5, 'right'),
        pad("Kosten/J", 8, 'right'),
        pad("Zuf", 4, 'right'),
        pad("Status", 10)
    ]
    header_str = " " + " | ".join(headers)
    sep_len = len(strip_ansi(header_str))

    print(f"\n{CLR_BOLD}{color}─── {icon} {title.upper()} ({len(lines)} Linien) " + ("─" * max(0, sep_len - len(title) - 25)) + f"{CLR_RESET}")
    print(header_str)
    print(" " + "─" * (sep_len - 1))
    
    for l in lines:
        v_cnt = l.get('vehicleCount', 0)
        stop_cnt = l.get('stopCount', 0)
        cap = l.get('capacity', 0)
        
        # Load
        load_live = l.get('load', 0)
        load_avg = l.get('avg_load_60s', 0.0)
        load_str = f"{load_live:>3}/{load_avg:>4.1f}"
        
        # Auslastung Bar (1m Durchschnitt)
        util_live = l.get('utilization', 0)
        util_avg = l.get('avg_util_60s', 0)
        bar = live_monitor.render_bar(int(round(load_avg)), cap, width=4)
        util_str = f"{bar} {util_avg:2d}%"

        # Wartungszustand & Kosten-Strafe
        maint_pct = l.get('maintState', 100)
        cost_pen = l.get('costPenalty', 0)
        maint_str = format_maint(maint_pct, cost_pen)

        # Flottenalter
        age_y = l.get('avgAgeYears', 0.0)
        f_age = l.get('formattedAge', '')
        age_str = format_age(age_y, f_age)

        # Wartende Fracht / Passagiere
        wait_cnt = l.get('totalWaiting', 0)
        if wait_cnt > 100:
            wait_str = f"{CLR_RED}{wait_cnt:>5}{CLR_RESET}"
        elif wait_cnt > 0:
            wait_str = f"{CLR_YELLOW}{wait_cnt:>5}{CLR_RESET}"
        else:
            wait_str = f"{CLR_GRAY}    0{CLR_RESET}"

        # Stations-Überlauf
        overflow_cnt = l.get('stationOverflow', 0)
        overflow_str = format_overflow(overflow_cnt)
            
        # Speed & Stau-Warner
        spd = l.get('avg_speed_60s', l.get('avgSpeed', 0))
        if v_cnt > 0 and spd == 0 and load_live > 0:
            spd_str = f"{CLR_RED}⚠️ 0km/h{CLR_RESET}"
        elif spd > 0:
            spd_str = f"{spd:>3} km/h"
        else:
            spd_str = f"{CLR_GRAY}  0 km/h{CLR_RESET}"
            
        # 1-Minuten Cashflow & Ertrag pro Fahrzeug
        cf_60s = l.get('cashflow_60s', 0)
        cf_str = live_monitor.format_money(cf_60s)
        if cf_60s > 0: cf_str = f"{CLR_GREEN}{cf_str}/m{CLR_RESET}"
        elif cf_60s < 0: cf_str = f"{CLR_RED}{cf_str}/m{CLR_RESET}"
        else: cf_str = f"{CLR_GRAY}$0/m{CLR_RESET}"

        per_fzg_str = format_per_vehicle(cf_60s, v_cnt)
        if cf_60s > 0: per_fzg_str = f"{CLR_GREEN}{per_fzg_str}{CLR_RESET}"
        elif cf_60s < 0: per_fzg_str = f"{CLR_RED}{per_fzg_str}{CLR_RESET}"

        freq_str = live_monitor.format_freq(l.get('frequency'))
        rate_str = live_monitor.format_rate(l.get('rate'))
        sat_val = l.get('satisfaction', 0)
        sat_str = f"{sat_val}%" if sat_val > 0 else "-"
        
        # Flottenkosten & Wert
        rc_str = live_monitor.format_money(l.get('runningCosts', 0))
        
        # Status / Warnung
        issue = l.get('lineIssue', '')
        if issue and issue != 'None':
            status_str = f"{CLR_RED}⚠️ {issue[:10]}{CLR_RESET}"
        elif overflow_cnt > 0:
            status_str = f"{CLR_RED}⚠️ Überlauf{CLR_RESET}"
        elif cost_pen >= 20:
            status_str = f"{CLR_YELLOW}⚠️ Wartung{CLR_RESET}"
        elif v_cnt > 0 and load_live == 0 and load_avg == 0:
            status_str = f"{CLR_YELLOW}Leerfahrt{CLR_RESET}"
        else:
            status_str = f"{CLR_GREEN}✔ Aktiv{CLR_RESET}"

        row = [
            pad(l['name'][:26], 26),
            pad(v_cnt, 3, 'right'),
            pad(stop_cnt, 3, 'right'),
            pad(cap, 4, 'right'),
            pad(load_str, 11, 'right'),
            pad(util_str, 14),
            pad(maint_str, 16),
            pad(age_str, 5),
            pad(wait_str, 7, 'right'),
            pad(overflow_str, 5, 'right'),
            pad(spd_str, 8, 'right'),
            pad(cf_str, 9, 'right'),
            pad(per_fzg_str, 7, 'right'),
            pad(freq_str, 5, 'right'),
            pad(rate_str, 5, 'right'),
            pad(rc_str, 8, 'right'),
            pad(sat_str, 4, 'right'),
            pad(status_str, 10)
        ]
        print(" " + " | ".join(row))



def main():
    os.system('cls' if os.name == 'nt' else 'clear')
    print("Starte TF3 Telemetrie Debug Suite...")
    last_update = 0
    
    while True:
        try:
            data = live_monitor.read_live_telemetry()
            if data and data.get('lines'):
                t = data.get('timestamp', 0)
                if t != last_update:
                    last_update = t
                    lines = data.get('lines', [])
                    
                    # 1. 60s Averages aktualisieren
                    for l in lines:
                        carrier = live_monitor.classify_line(l.get('name', ''), l.get('vehicles'), l.get('carrier'))
                        l['carrier_category'] = carrier
                        update_60s_averages(l)
                        
                    # 2. Rendering
                    now_str = time.strftime('%H:%M:%S')
                    game_date = data.get('gameDate') or "Laufend"
                    elapsed = int(time.time() - start_time)
                    window_fill = min(60, elapsed)
                    
                    os.system('cls' if os.name == 'nt' else 'clear')
                    print("╔" + "═" * 166 + "╗")
                    print(f"║ {CLR_BOLD}{CLR_CYAN}TF3 TELEMETRIE DEBUG & TIEFEN-PRÜFSTAND (1-MINUTEN DURCHSCHNITT){CLR_RESET}              Datum: {game_date:<15} Stand: {now_str}               ║")
                    print(f"║ Puffer-Füllstand: {window_fill:02d}/60 Sekunden ({int((window_fill/60)*100)}%)   Linien im Spiel: {len(lines):<3}        Status: {CLR_GREEN}● LIVE MIT SPIEL-ENGINE VERBUNDEN{CLR_RESET}            ║")
                    print("╚" + "═" * 166 + "╝")
                    
                    road_cargo = [l for l in lines if l.get('carrier_category') == 'ROAD_CARGO']
                    road_person = [l for l in lines if l.get('carrier_category') == 'ROAD_PERSON']
                    rail_lines = [l for l in lines if l.get('carrier_category') == 'RAIL']
                    water_lines = [l for l in lines if l.get('carrier_category') == 'WATER']
                    air_lines = [l for l in lines if l.get('carrier_category') == 'AIR']

                    render_category_debug("GÜTER & LKW (Road Cargo)", "🚚", CLR_CYAN, road_cargo)
                    render_category_debug("ÖPNV & BUSSE (Road Passenger)", "🚌", CLR_GREEN, road_person)
                    render_category_debug("SCHIENE & ZÜGE (Rail)", "🚆", CLR_YELLOW, rail_lines)
                    render_category_debug("WASSER & SCHIFFE (Water)", "🚢", CLR_BLUE, water_lines)
                    render_category_debug("LUFT & FLUGZEUGE (Air)", "✈️", CLR_MAGENTA, air_lines)
                    
                    print("\n" + "─" * 175)
                    print(f" {CLR_BOLD}🔍 ERKLÄRUNG DER ENGINE-METRIKEN:{CLR_RESET}")
                    print(f" • {CLR_BOLD}Zustand (Strafe){CLR_RESET}: Flotten-Wartungszustand in % & resultierende Kosten-Strafe (z.B. 95% (+0%) vs 38% (+15% Mehrkosten)).")
                    print(f" • {CLR_BOLD}Alter{CLR_RESET}: Durchschnittliches Flottenalter der Fahrzeuge in Jahren/Monaten.")
                    print(f" • {CLR_BOLD}Wartend / Überl{CLR_RESET}: Wartende Fracht an Terminals | ⚠️ Überlauf = vernichtete Fracht wegen voller Bahnhofs-Puffer.")
                    print(f" • {CLR_BOLD}1m-Saldo / $/Fzg{CLR_RESET}: Netto-Cashflow der Linie in den letzten 60s & Netto-Ertrag pro Einzelfahrzeug.")
                    print(f" • {CLR_BOLD}Load Live/1m & Auslastung{CLR_RESET}: Momentaner Frachtstand vs. geglätteter 60s-Durchschnitt.")


            time.sleep(1.0)
        except KeyboardInterrupt:
            print("\nDebug-Monitor beendet.")
            break
        except Exception as e:
            time.sleep(1.0)

if __name__ == '__main__':
    main()
