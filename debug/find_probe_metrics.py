# Test what metrics can be captured from the engine and print them into stdout/json
import os
import glob

def get_stdout_path():
    appdata = os.environ.get('APPDATA', '')
    candidates = glob.glob(os.path.join(appdata, 'GSE Saves', '*', 'local', 'crash_dump', 'stdout.txt'))
    if candidates:
        return candidates[0]
    return os.path.join(appdata, 'Transport Fever 3', 'crash_dump', 'stdout.txt')

p = get_stdout_path()
if os.path.exists(p):
    with open(p, 'rb') as f:
        f.seek(max(0, os.path.getsize(p) - 50000))
        tail = f.read().decode('utf-8', errors='ignore')
    for line in tail.splitlines()[-15:]:
        if "[TF3_" in line:
            print(line[:120])
else:
    print(f"stdout.txt not found at {p}")
