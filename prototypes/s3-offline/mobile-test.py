"""Offline diagnostic navigation and recovery at a 390 px viewport in the normal editor."""
import json
import os
import subprocess
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[2]
engine = sys.argv[1] if len(sys.argv) > 1 else 'chromium'
assert engine in ('chromium', 'webkit')
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

with TemporaryDirectory() as temp, sync_playwright() as pw:
    folder = Path(temp)
    path = folder/'AHT10.json'
    subprocess.run(['node','--import','tsx','prototypes/s3-offline/environment-example.ts',str(path)],cwd=root,check=True)
    project = json.loads(path.read_text())
    aux = 'src/interval.c'
    correct = project['files'][aux]
    project['files'][aux] = correct.replace('return 500;', 'return pokvareno;')
    path.write_text(json.dumps(project))
    server = ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=root/'dist'))
    url = f'http://127.0.0.1:{server.server_port}/'
    Thread(target=server.serve_forever,daemon=True).start()
    def launch():
        browser=getattr(pw,engine)
        return browser.launch_persistent_context(folder/'profile',viewport={'width':390,'height':844},
            is_mobile=True,has_touch=True,executable_path=os.environ.get(engine.upper()+'_PATH') or browser.executable_path)
    context=launch()
    page=context.new_page()
    def button(label): return page.get_by_role('button',name=label,exact=True)
    page.goto(url)
    page.locator('input[accept=".zip,.json"]').set_input_files(path)
    page.wait_for_function('!!navigator.serviceWorker.controller',timeout=120000)
    button('Prevedi').click()
    button('Spremi S3 paket').click()
    panel=page.get_by_role('region',name='ESP32-S3 u pregledniku')
    expect(panel).to_contain_text('S3 paket je spreman',timeout=180000)
    context.close()
    server.shutdown()
    server.server_close()
    context=launch()
    if engine=='chromium': context.set_offline(True)
    page=context.new_page()
    page.on('console',lambda entry: print(entry.text,flush=True) if entry.type=='error' else None)
    response=page.goto(url)
    assert response.from_service_worker
    button('Prevedi').click()
    panel=page.get_by_role('region',name='ESP32-S3 u pregledniku')
    page.evaluate("""() => {
      window.phaseLog=[]; window.maxGap=0; let last=performance.now();
      window.heartbeat=setInterval(()=>{let now=performance.now();maxGap=Math.max(maxGap,now-last);last=now;},50);
      const el=document.querySelector('[aria-label="ESP32-S3 u pregledniku"] [role="status"]');
      new MutationObserver(()=>phaseLog.push(el.textContent)).observe(el,{subtree:true,childList:true,characterData:true});
    }""")
    button('Prevedi u pregledniku').click()
    issue=panel.locator('.build-messages button').first
    try:
        expect(issue).to_be_visible(timeout=125000)
    except AssertionError:
        print(panel.inner_text(),page.evaluate("phaseLog"),flush=True)
        raise
    assert issue.inner_text().startswith("src/interval.c:4:"), issue.inner_text()
    col=issue.inner_text().split(':')[-1]
    box=issue.bounding_box()
    assert box['x']>=0 and box['x']+box['width']<=391, box
    phases,gap=page.evaluate('() => {clearInterval(heartbeat);return [phaseLog,maxGap]}')
    assert any(aux in p for p in phases), phases
    issue.click()
    expect(page.locator('.cm-content')).to_be_visible()
    expect(page.locator('.cm-content')).to_contain_text('return pokvareno;')
    expect(page.get_by_text(f'Redak 4, stupac {col}',exact=True)).to_be_attached()
    cm=page.locator('.cm-content')
    cm.click()
    cm.press('Control+a')
    page.keyboard.insert_text(correct)
    page.locator('.save-state.saved').wait_for()
    button('Prevedi').click()
    button('Prevedi u pregledniku').click()
    expect(panel).to_contain_text('Prevedeno.',timeout=125000)
    expect(panel.locator('.build-messages button')).to_have_count(0)
    button('Zatvori prozor').click()
    button('Pokreni').click()
    button('Izlaz').click()
    expect(page.locator('[aria-label="Izlaz programa"]')).to_contain_text('T=24.0 C, RH=50.0',timeout=30000)
    context.close()
    print(f'{engine}: PASS offline restart, compile phases, src/interval.c:4:{col}, edit, rerun. Maximum sampled UI gap {gap:.0f} ms.')
