import os

game_dir = os.environ.get("TF3_GAME_DIR", r"E:\Spiele\Transport.Fever.3\Transport Fever 3")
tealdef_dir = os.path.join(game_dir, "api", "tealdef")
p = os.path.join(tealdef_dir, "api", "engine.d.tl")

if not os.path.exists(p):
    print(f"Tealdef files not found at {p}. Set TF3_GAME_DIR to inspect game API.")
    exit(0)

s = open(p, encoding='utf-8', errors='ignore').read()
for line in s.splitlines():
    if "Maintenance" in line or "maintenance" in line:
        print(line)
