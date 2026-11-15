from pathlib import Path
import json

root = Path(__file__).resolve().parent.parent
lock = json.loads((root / 'package-lock.json').read_text())
parts = ['ESP32 MicroPython Lab — third-party notices\n\nFrontend and build dependencies. Runtime notices also remain in the other files in this directory.\n']
for rel, meta in lock['packages'].items():
    if not rel:
        continue
    path = root / rel
    licenses = sorted(p for p in path.glob('*') if p.is_file() and p.name.lower().startswith(('license', 'copying', 'notice')))
    parts.append('\n' + '=' * 72 + '\n' + rel + ' @ ' + meta.get('version', '?') + ' (' + str(meta.get('license', 'see package')) + ')\n')
    for license_file in licenses:
        parts.append(license_file.name + '\n' + license_file.read_text(errors='replace') + '\n')
out = root / 'public/licenses/THIRD-PARTY.txt'
out.write_text('\n'.join(parts))
print(out)
