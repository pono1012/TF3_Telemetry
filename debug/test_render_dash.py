import live_monitor
import debug_monitor
import re
ANSI_REGEX = re.compile(r'\x1b\[[0-9;]*m')

def strip_ansi(text):
    return ANSI_REGEX.sub('', str(text))

def pad_ansi(text, width, align='left'):
    visible_len = len(strip_ansi(text))
    pad = max(0, width - visible_len)
    if align == 'right':
        return (' ' * pad) + str(text)
    return str(text) + (' ' * pad)

data = live_monitor.read_live_telemetry()
if data and data.get('lines'):
    lines = data.get('lines', [])
    for l in lines:
        l['carrier_category'] = live_monitor.classify_line(l.get('name', ''), l.get('vehicles'), l.get('carrier'))
        debug_monitor.update_60s_averages(l)
    road_cargo = [l for l in lines if l.get('carrier_category') == 'ROAD_CARGO']
    road_person = [l for l in lines if l.get('carrier_category') == 'ROAD_PERSON']
    rail_lines = [l for l in lines if l.get('carrier_category') == 'RAIL']
    water_lines = [l for l in lines if l.get('carrier_category') == 'WATER']
    air_lines = [l for l in lines if l.get('carrier_category') == 'AIR']

    debug_monitor.render_category_debug('GÜTER & LKW (Road Cargo)', '🚚', debug_monitor.CLR_CYAN, road_cargo[:2])
    debug_monitor.render_category_debug('ÖPNV & BUSSE (Road Passenger)', '🚌', debug_monitor.CLR_GREEN, road_person[:2])
    debug_monitor.render_category_debug('SCHIENE & ZÜGE (Rail)', '🚆', debug_monitor.CLR_YELLOW, rail_lines[:2])
    debug_monitor.render_category_debug('WASSER & SCHIFFE (Water)', '🚢', debug_monitor.CLR_BLUE, water_lines[:2])
    debug_monitor.render_category_debug('LUFT & FLUGZEUGE (Air)', '✈️', debug_monitor.CLR_MAGENTA, air_lines[:2])
    print('All 5 categories rendered cleanly!')

