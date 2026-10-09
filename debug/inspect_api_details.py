import os

game_dir = os.environ.get("TF3_GAME_DIR", r"E:\Spiele\Transport.Fever.3\Transport Fever 3")
tealdef_dir = os.path.join(game_dir, "api", "tealdef")

system_dtl = os.path.join(tealdef_dir, "api", "engine", "system.d.tl")
type_dtl = os.path.join(tealdef_dir, "api", "type.d.tl")
util_dtl = os.path.join(tealdef_dir, "api", "engine", "util.d.tl")

if not os.path.exists(system_dtl):
    print(f"Tealdef files not found at {tealdef_dir}. Set TF3_GAME_DIR to inspect game API.")
    exit(0)

with open(system_dtl, 'r', encoding='utf-8', errors='ignore') as f:
    sys_content = f.read()

print("=== system.d.tl around lineSystem ===")
pos = sys_content.find("lineSystem")
if pos != -1:
    print(sys_content[max(0, pos-200):min(len(sys_content), pos+800)])

print("\n=== all systems in system.d.tl ===")
for line in sys_content.splitlines():
    if "System :" in line or "system :" in line or "record " in line:
        print(" ", line.strip())

with open(type_dtl, 'r', encoding='utf-8', errors='ignore') as f:
    type_content = f.read()

print("\n=== Line component or Line in type.d.tl ===")
pos = type_content.find("record Line")
if pos != -1:
    print(type_content[pos:pos+1500])
else:
    pos2 = type_content.find("enum ComponentType")
    if pos2 != -1:
        print(type_content[pos2:pos2+1000])
