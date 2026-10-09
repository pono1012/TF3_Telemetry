import re

import os

path = os.path.join(os.path.dirname(__file__), 'companion-mod', 'tf3_telemetry', 'content', 'telemetry.script.lua')
if not os.path.exists(path):
    path = os.path.join(os.path.dirname(__file__), 'telemetry.live.lua')
content = open(path, encoding='utf-8').read()

# Remove comments and strings
clean = re.sub(r'--.*', '', content)
clean = re.sub(r'"(\\.|[^"\\])*"', '""', clean)
clean = re.sub(r"'(\\.|[^'\\])*'", "''", clean)

# Tokens
tokens = re.findall(r'\b(function|if|elseif|then|else|do|end)\b', clean)

depth = 0
for t in tokens:
    if t in ('function', 'do'):
        depth += 1
    elif t == 'if':
        depth += 1
    elif t == 'end':
        depth -= 1

print(f"Total tokens: {len(tokens)}")
print(f"Calculated depth at EOF: {depth}")
