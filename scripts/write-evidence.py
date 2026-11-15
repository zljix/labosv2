"""Record a measured pinned runtime build; no browser test is fabricated here."""
import hashlib
import json
import argparse
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--stage', default='3', help='Stage label for separate measured evidence')
parser.add_argument('--first-checksums', required=True, type=Path, help='SHA256SUMS retained from the first clean build')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
checksums = {}
for line in (root / 'runtime/SHA256SUMS').read_text().splitlines():
    digest, name = line.split()
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest
    checksums[name] = digest

provenance = {
    'releaseVersion': json.loads((root / 'package.json').read_text())['version'],
    'source': {'version': 'MicroPython v1.29.0', 'archive': 'https://codeload.github.com/micropython/micropython/tar.gz/refs/tags/v1.29.0', 'sha256': '8072f6ad42c0e3bbfca88ed09bf8f1106ce207a39129af920f70081b8f2fe286'},
    'toolchain': {'emscripten': '4.0.15', 'sdkArchiveSha256': '35be7626493e3bd22860ee2177147f9bca3b6ff871edeab27c5b061a9ed9d23d', 'sourceDateEpoch': 1794441600},
    'patches': {p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in ['scripts/patch-runtime.py', 'runtime/modlab.c', 'runtime/variant/mpconfigvariant.h', 'runtime/variant/mpconfigvariant.mk']},
    'outputs': checksums,
}
(root / 'runtime/build-provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')

# The repeat result is recorded only after comparing the saved first clean build.
first = args.first_checksums
assert first.read_text() == (root / 'runtime/SHA256SUMS').read_text()
repeat = {'performedOn': '2026-11-12', 'cleanBuilds': 2, 'sameEnvironment': True, 'byteIdentical': True, 'scope': 'Same Linux x86_64 environment and pinned toolchain; not an independent cross-host reproducibility claim.', 'outputs': checksums}
(root / f'docs/reproducibility-stage{args.stage}.json').write_text(json.dumps(repeat, indent=2) + '\n')
(root / f'public/verification/reproducibility-stage{args.stage}.json').write_text(json.dumps(repeat, indent=2) + '\n')
print(json.dumps({'artifacts': len(checksums), 'repeatMatches': True}))
