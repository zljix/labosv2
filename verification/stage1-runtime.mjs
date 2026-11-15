import { Worker } from "node:worker_threads";
import { readFile, writeFile } from "node:fs/promises";
import { Session } from "../dist/session.mjs";
const machine = await readFile(
  new URL("../dist/machine.py", import.meta.url),
  "utf8",
);
const factory = () => {
  const worker = new Worker(new URL("./node-worker.mjs", import.meta.url)),
    shim = {
      postMessage: (d) => worker.postMessage(d),
      terminate: () => worker.terminate(),
    };
  worker.on("message", (data) => shim.onmessage?.({ data }));
  worker.on("error", (error) => shim.onerror?.(error));
  return shim;
};
const results = [];
async function check(name, code, files, expect, ok = true) {
  const session = new Session(factory, machine, code, {}, () => {}, files);
  try {
    await session.wait((s) => ["done", "error"].includes(s.status));
    const text =
      session.text + session.events.map((e) => e.message ?? "").join("\n");
    if (session.status !== (ok ? "done" : "error") || !text.includes(expect))
      throw Error(text);
    results.push({ name, status: "pass", output: text.trim() });
  } catch (e) {
    results.push({ name, status: "fail", error: String(e) });
  } finally {
    await session.stop();
  }
}
await check(
  "main imports helper and nested package",
  "from pomoc import poruka\nfrom lib.config import BROJ\nprint(poruka, BROJ)",
  {
    "pomoc.py": 'poruka="POMOC_RADI"',
    "lib/__init__.py": "",
    "lib/config.py": "BROJ=42",
  },
  "POMOC_RADI 42",
);
await check(
  "text data is available to Python",
  "print(open('/podaci.txt').read())",
  { "podaci.txt": "PODACI_RADE" },
  "PODACI_RADE",
);
await check(
  "internal module override is rejected",
  "print(1)",
  { "machine.py": "print(2)" },
  "Nedopuštena",
  false,
);
const report = {
  generatedAt: new Date().toISOString(),
  runtime: "MicroPython v1.29.0",
  results,
  passed: results.filter((r) => r.status === "pass").length,
  total: results.length,
};
await writeFile(
  new URL("../docs/results-stage1-runtime.json", import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
if (report.passed !== report.total) process.exitCode = 1;
