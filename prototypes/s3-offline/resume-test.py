"""Verify partial installation survives restart and only missing S3 files are fetched."""
import json
import os
import subprocess
import sys
from collections import Counter
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from urllib.parse import urlsplit
from playwright.sync_api import expect, sync_playwright

root = Path(__file__).resolve().parents[2]
engine = sys.argv[1]
files = json.loads((root/'dist/offline-package.json').read_text())['optionalS3']
paths = [f['url'] for f in files]
cut = 4
requests = Counter()
broken = True

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_GET(self):
        path = urlsplit(self.path).path
        if path in paths:
            requests[path] += 1
        if broken and path == paths[cut]:
            if engine == 'chromium':
                self.send_error(503)
            else:
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'incorrect content')
            return
        super().do_GET()

fixture = subprocess.check_output(['node','--import','tsx','--input-type=module','-e',
    "import {s3ExampleProject} from './src/runtime/s3Examples.ts';"
    "const p=s3ExampleProject('blink'); delete p.files['s3-build.json']; console.log(JSON.stringify(p));"],cwd=root)
fixture = fixture.replace(b'S3 LED=1', b'OBNOVLJEN-S3')
server = ThreadingHTTPServer(('127.0.0.1',0), partial(Handler,directory=root/'dist'))
url = f'http://127.0.0.1:{server.server_port}/'
Thread(target=server.serve_forever,daemon=True).start()
with TemporaryDirectory() as profile, sync_playwright() as pw:
    def open_project():
        browser = getattr(pw,engine)
        context = browser.launch_persistent_context(profile, viewport={'width':1440,'height':1000},
            executable_path=os.getenv(engine.upper()+'_PATH') or browser.executable_path)
        page = context.new_page()
        page.goto(url)
        return context, page
    def button(label): return page.get_by_role('button',name=label,exact=True)
    def panel(): return page.get_by_role('region',name='ESP32-S3 u pregledniku')
    context, page = open_project()
    page.locator('input[accept=".zip,.json"]').set_input_files({'name':'resume.json','mimeType':'application/json','buffer':fixture})
    expect(page.locator('.cm-content')).to_contain_text('OBNOVLJEN-S3')
    page.wait_for_function('!!navigator.serviceWorker.controller',timeout=120000)
    button('Prevedi').click()
    button('Spremi S3 paket').click()
    expect(panel()).to_contain_text('HTTP 503' if engine=='chromium' else 'Sadržaj ne odgovara',timeout=180000)
    expect(panel()).to_contain_text(f'{cut}/{len(paths)} datoteka')
    expect(button('Prevedi u pregledniku')).to_be_disabled()
    assert requests[paths[cut]] == 2
    counts = [requests[path] for path in paths[:cut]]
    assert counts == [1]*cut
    context.close()
    broken = False
    context, page = open_project()
    expect(page.locator('.cm-content')).to_contain_text('OBNOVLJEN-S3')
    button('Prevedi').click()
    expect(panel()).to_contain_text(f'{cut}/{len(paths)} datoteka')
    button('Nastavi spremanje S3 paketa').click()
    expect(panel()).to_contain_text('S3 paket je spreman',timeout=180000)
    assert [requests[path] for path in paths[:cut]] == counts
    assert requests[paths[cut]] == 3
    context.close()
    server.shutdown()
    server.server_close()
    context, page = open_project()
    expect(page.locator('.cm-content')).to_contain_text('OBNOVLJEN-S3')
    button('Prevedi').click()
    button('Prevedi u pregledniku').click()
    expect(panel()).to_contain_text('Prevedeno.',timeout=120000)
    button('Zatvori prozor').click()
    button('Pokreni').click()
    expect(page.locator('[aria-label="Izlaz programa"]')).to_contain_text('OBNOVLJEN-S3',timeout=30000)
    context.close()
    print(engine,'PASS: verified partial progress, restart, resume, request counts, project persistence and offline execution')
