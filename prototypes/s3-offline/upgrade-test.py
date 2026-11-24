"""Upgrade from an earlier pilot served on the same origin, then compile offline."""
import json
import os
import sys
from collections import Counter
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from urllib.parse import urlsplit
from playwright.sync_api import expect, sync_playwright

root = Path(__file__).resolve().parents[2]
engine, previous, sample = sys.argv[1:4]
old = Path(previous).resolve()
new = root / 'dist'
served = old
requests = Counter()
old_manifest, new_manifest = [
    json.loads((folder / 'offline-package.json').read_text()) for folder in (old, new)
]
assert old_manifest['build'] != new_manifest['build']
new_paths = [f['url'] for f in new_manifest['optionalS3']]
corrupt = '--corrupt' in sys.argv
fixture = Path(sample).read_bytes().replace(b'S3 LED=1', b'SACUVAN-S3')

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=served, **kwargs)
    def log_message(self, *args): pass
    def do_GET(self):
        path = urlsplit(self.path).path
        if path in new_paths:
            requests[path] += 1
        super().do_GET()

server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}/'
with TemporaryDirectory() as profile, sync_playwright() as pw:
    def launch():
        browser = getattr(pw, engine)
        return browser.launch_persistent_context(profile, viewport={'width':1440,'height':1000},
            executable_path=os.getenv(engine.upper()+'_PATH') or browser.executable_path)
    context = launch()
    page = context.pages[0]
    def click(label):
        page.get_by_role('button', name=label, exact=True).click(timeout=120000)
    def panel():
        return page.get_by_role('region', name='ESP32-S3 u pregledniku')
    page.goto(url)
    page.locator('input[accept=".zip,.json"]').set_input_files({'name':'upgrade.json','mimeType':'application/json','buffer':fixture})
    expect(page.locator('.cm-content')).to_contain_text('SACUVAN-S3')
    page.wait_for_function('!!navigator.serviceWorker.controller', timeout=120000)
    click('Prevedi')
    click('Spremi S3 paket')
    expect(panel()).to_contain_text('S3 paket je spreman',timeout=180000)
    click('Zatvori prozor')
    if corrupt:
        entry = old_manifest['optionalS3'][1]
        page.evaluate("""async ({cache, path}) => {
            const storage = await caches.open(cache);
            const bytes = new Uint8Array(await (await storage.match(path)).arrayBuffer());
            bytes[0] ^= 1;
            await storage.put(path, new Response(bytes));
        }""", {'cache':'esp32-micropython-lab-app-'+old_manifest['build'], 'path':entry['url']})
    served = new
    click('Status aplikacije i offline rad')
    click('Provjeri novu verziju / ponovi preuzimanje')
    with page.expect_navigation(timeout=120000):
        click('Spremi i otvori novu verziju')
    expect(page.locator('.cm-content')).to_contain_text('SACUVAN-S3')
    click('Prevedi')
    click('Spremi S3 paket')
    expect(panel()).to_contain_text('S3 paket je spreman', timeout=180000)
    assert requests == (Counter({new_paths[1]:1}) if corrupt else Counter()), requests
    context.close()
    server.shutdown()
    server.server_close()
    context = launch()
    page = context.pages[0]
    page.goto(url)
    expect(page.locator('.cm-content')).to_contain_text('SACUVAN-S3')
    click('Prevedi')
    click('Prevedi u pregledniku')
    expect(panel()).to_contain_text('Prevedeno.', timeout=120000)
    click('Zatvori prozor')
    click('Pokreni')
    expect(page.locator('[aria-label="Izlaz programa"]')).to_contain_text('SACUVAN-S3',timeout=30000)
    context.close()
    print(engine, 'PASS: update, preserved project, optional downloads:',sum(requests.values()),'offline execution')
