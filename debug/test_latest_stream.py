import os, json, re, glob

def get_stdout_path():
    appdata = os.environ.get('APPDATA', '')
    candidates = glob.glob(os.path.join(appdata, 'GSE Saves', '*', 'local', 'crash_dump', 'stdout.txt'))
    if candidates:
        return candidates[0]
    return os.path.join(appdata, 'Transport Fever 3', 'crash_dump', 'stdout.txt')

stdout_path = get_stdout_path()

if os.path.exists(stdout_path):
    with open(stdout_path, 'rb') as f:
        f.seek(max(0, os.path.getsize(stdout_path) - 30000))
        tail = f.read().decode('utf-8', errors='ignore')

    matches = list(re.finditer(r'\[TF3_LIVE_TELEMETRY\](.*)', tail))
    if matches:
        last = matches[-1].group(1).strip()
        data = json.loads(last)
        print(f"Total lines in last payload: {len(data.get('lines', []))}")
        sample = data.get('lines', [])[0]
        print(f"Sample line '{sample.get('name')}':")
        for k, v in sample.items():
            if k != 'vehicles':
                print(f"  {k}: {v}")
    
    # check for probe
    for line in tail.splitlines():
        if "TF3_METRICS_PROBE" in line:
            print("PROBE FOUND:", line)
