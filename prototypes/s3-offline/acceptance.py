"""Run with Python Playwright and Chromium after npm run build."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
from tempfile import TemporaryDirectory
from threading import Thread
from shutil import which
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent
server = ThreadingHTTPServer(("127.0.0.1", 0), partial(SimpleHTTPRequestHandler, directory=root / "release"))
address = f"http://127.0.0.1:{server.server_port}/"
Thread(target=server.serve_forever, daemon=True).start()

with TemporaryDirectory() as profile, sync_playwright() as pw:
    def launch():
        return pw.chromium.launch_persistent_context(profile, executable_path=os.getenv("CHROMIUM_PATH") or which("chromium"))
    context = launch()
    page = context.new_page()
    page.goto(address)
    page.click("#prepare")
    page.wait_for_function("document.querySelector('#status').textContent.includes('Možeš isključiti')", timeout=120000)
    print("Prepared", flush=True)
    original = page.locator("#code").input_value()
    context.close()
    server.shutdown()
    server.server_close()
    context = launch()
    context.set_offline(True)
    page = context.new_page()
    page.on("pageerror", lambda e: print("Page:", e, flush=True))
    page.on("console", lambda e: print(e.text[:180], flush=True))
    page.goto(address)
    print("Reopened", flush=True)
    source = original.replace("300", "71").replace("LED ukljucena", "S3 OFFLINE 71")
    page.fill("#code", source)
    page.evaluate("""() => { window.framesSeen = []; new MutationObserver(() => {
      framesSeen.push([+document.querySelector('#time').textContent,document.querySelector('#led').classList.contains('on')]);
    }).observe(document.querySelector('#time'), {childList:true}); }""")
    page.click("#run")
    page.wait_for_function("!document.querySelector('#run').disabled", timeout=125000)
    print("Compiled", flush=True)
    status = page.locator("#status").inner_text()
    assert status == "Simulacija dovršena.", status
    assert page.locator("#serial").inner_text().count("S3 OFFLINE 71") == 4
    frames = page.evaluate("framesSeen")
    assert any(lit for _, lit in frames) and not frames[-1][1], frames
    assert 568 <= frames[-1][0] <= 575, frames
    page.fill("#code", source.replace("Serial.begin(9600);", "oops;"))
    page.click("#run")
    page.wait_for_function("!document.querySelector('#run').disabled", timeout=125000)
    assert "main.ino:" in page.locator("#status").inner_text()
    assert not page.locator("#serial").inner_text()
    context.close()
    print("PASS: cold offline restart, edited source, GPIO4 LED, delay, Serial, syntax error", frames)
