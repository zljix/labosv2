"""Exercise the normal Labos editor against a built dist/ and a fresh persistent Chromium profile."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import os
import subprocess
from shutil import which
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[2]
fixture = subprocess.check_output(["node","--import","tsx","--input-type=module","-e",
    "import {s3ExampleProject} from './src/runtime/s3Examples.ts';"
    "const p=s3ExampleProject('blink'); delete p.files['s3-build.json']; console.log(JSON.stringify(p));"],cwd=root)
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server = ThreadingHTTPServer(("127.0.0.1",0), partial(QuietHandler,directory=root/"dist"))
Thread(target=server.serve_forever,daemon=True).start()
url = f"http://127.0.0.1:{server.server_port}/"

with TemporaryDirectory() as profile, sync_playwright() as pw:
    def launch():
        return pw.chromium.launch_persistent_context(profile,executable_path=os.getenv("CHROMIUM_PATH") or which("chromium"),
            viewport={"width":1440,"height":1000})
    def click(label):
        page.get_by_role("button",name=label,exact=True).click()
    def edit(source):
        cm=page.locator(".cm-content")
        cm.click()
        cm.press("Control+a")
        page.keyboard.insert_text(source)
        page.locator(".save-state.saved").wait_for()
    context=launch()
    page=context.new_page()
    page.goto(url)
    page.locator('input[accept=".zip,.json"]').set_input_files({"name":"blink.json","mimeType":"application/json","buffer":fixture})
    expect(page.locator(".cm-content")).to_contain_text("S3 LED=1")
    page.wait_for_function("!!navigator.serviceWorker.controller",timeout=120000)
    click("Prevedi")
    click("Spremi S3 paket")
    panel=page.get_by_role("region",name="ESP32-S3 u pregledniku")
    expect(panel).to_contain_text("S3 paket je spreman",timeout=150000)
    click("Zatvori prozor")
    context.close()
    server.shutdown()
    server.server_close()
    context=launch()
    context.set_offline(True)
    page=context.new_page()
    response=page.goto(url)
    assert response.from_service_worker
    source="""void setup(){Serial.begin(9600);pinMode(4,OUTPUT);}
void loop(){digitalWrite(4,HIGH);Serial.println("NOVI-S3-71");delay(71);digitalWrite(4,LOW);delay(71);}"""
    edit(source)
    click("Prevedi")
    click("Prevedi u pregledniku")
    click("Prekini prevođenje")
    panel=page.get_by_role("region",name="ESP32-S3 u pregledniku")
    expect(panel).to_contain_text("otkazano")
    click("Prevedi u pregledniku")
    expect(panel).to_contain_text("Prevedeno.",timeout=120000)
    click("Zatvori prozor")
    click("Pokreni")
    expect(page.locator('[aria-label="Izlaz programa"]')).to_contain_text("NOVI-S3-71",timeout=30000)
    led=page.locator('[data-testid="part-led1"] [data-brightness]')
    expect(led).to_have_attribute("data-brightness","0",timeout=10000)
    page.wait_for_function("""Number(document.querySelector('[data-testid="part-led1"] [data-brightness]')?.getAttribute('data-brightness'))>0""")
    click("Zaustavi")
    page.locator(".save-state.saved").wait_for()
    context.close()
    context=launch()
    context.set_offline(True)
    page=context.new_page()
    page.goto(url)
    click("Pokreni")
    expect(page.locator('[aria-label="Izlaz programa"]')).to_contain_text("NOVI-S3-71",timeout=30000)
    click("Zaustavi")
    edit(source.replace("Serial.begin(9600);","oops;"))
    click("Prevedi")
    click("Prevedi u pregledniku")
    panel=page.get_by_role("region",name="ESP32-S3 u pregledniku")
    expect(panel).to_contain_text("main.ino:1:",timeout=120000)
    click("Zatvori prozor")
    click("Pokreni")
    expect(panel).to_be_visible()
    click("Zatvori prozor")
    with TemporaryDirectory() as sample_dir:
        sample=Path(sample_dir)/"S3_AHT10_OLED.json"
        subprocess.run(["node","--import","tsx","prototypes/s3-offline/environment-example.ts",str(sample)],cwd=root,check=True)
        page.locator('input[accept=".zip,.json"]').set_input_files(sample)
    expect(page.locator(".cm-content")).to_contain_text("LabAHT10")
    click("Prevedi")
    click("Prevedi u pregledniku")
    expect(panel).to_contain_text("Prevedeno.",timeout=120000)
    click("Zatvori prozor")
    click("Pokreni")
    console=page.locator('[aria-label="Izlaz programa"]')
    expect(console).to_contain_text("T=24.0 C, RH=50.0",timeout=30000)
    oled=page.locator('[data-testid="part-oled1"] .pixel-display path')
    before=oled.get_attribute("d")
    assert before and "M" in before
    page.get_by_role("slider",name="Temperatura AHT10").press("End")
    expect(console).to_contain_text("T=85.0 C, RH=50.0",timeout=30000)
    assert oled.get_attribute("d") != before
    click("Zaustavi")
    context.close()
    print("PASS: main editor import, offline restart, source edit, cancel/retry, compile, run, LED levels, persistent result, diagnostics, stale result rejection, mixed C/C++ and live AHT10 + OLED")
