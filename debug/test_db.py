import live_monitor
import sqlite3

d = live_monitor.read_live_telemetry()
if d:
    print('Total lines in data:', len(d.get('lines', [])))
    live_monitor.update_line_metrics(d['lines'])
    live_monitor.store_telemetry_batch(d)
    print('Successfully stored batch in SQLite DB!')
    
    conn = sqlite3.connect(live_monitor.DB_PATH)
    c = conn.cursor()
    c.execute('SELECT COUNT(*) FROM line_telemetry')
    print('Total DB rows in line_telemetry:', c.fetchone()[0])
    
    c.execute('SELECT line_name, load, capacity, utilization, cashflow, running_cost, directional_ratio FROM line_telemetry LIMIT 5')
    for row in c.fetchall():
        print("  Sample DB Row:", row)
    conn.close()
else:
    print('No live data available to test')
