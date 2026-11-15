import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { zipSync, strToU8 } from "fflate";
import {
  clone,
  newProject,
  editProject,
  parseProject,
  validPath,
  LIMITS,
} from "../src/project/model";
import { exportZip, importProject } from "../src/project/archive";
import { ProjectStore, ConflictError } from "../src/project/storage";
test("ZIP and JSON preserve Unicode, helper files and settings", () => {
  const p = newProject(
    "from pomoc import poruka\nprint(poruka)",
    "Školski pokus",
  );
  p.files["pomoc.py"] = 'poruka="Živio svijet!"';
  p.files["lib/__init__.py"] = "";
  p.settings = {
    ...p.settings,
    activeFile: "pomoc.py",
    fontSize: 18,
    theme: "dark",
    powered: false,
    swapped: true,
  };
  assert.deepEqual(importProject(exportZip(p), "p.zip"), p);
  assert.deepEqual(importProject(strToU8(JSON.stringify(p)), "p.json"), p);
});
test("future schemas and unknown board profiles are rejected", () => {
  const p = newProject();
  assert.throws(() => parseProject({ ...p, schemaVersion: 99 }), /Inačica/);
  assert.throws(
    () => parseProject({ ...p, board: { ...p.board, id: "esp32-s6" } }),
    /Profil/,
  );
});
test("entrypoint, settings and circuit scope are validated", () => {
  const p = newProject();
  assert.throws(
    () => parseProject({ ...p, files: { "pomoc.py": "" } }),
    /main.py/,
  );
  assert.throws(
    () =>
      parseProject({
        ...p,
        settings: { ...p.settings, activeFile: "missing.py" },
      }),
    /postavke/,
  );
  assert.throws(
    () =>
      parseProject({
        ...p,
        circuit: { kind: "stage0-fixture", components: [{}], wires: [] },
      }),
    /ispitni/,
  );
});
test("traversal, scripts, internal overrides and case collisions are rejected", () => {
  for (const path of [
    "../x.py",
    "/main.py",
    "a/../../x.py",
    "a\\x.py",
    "worker.js",
    "machine.py",
    "lib/machine.py",
    "_lab.py",
    "project.json",
    "a//x.py",
    "a/./x.py",
  ])
    assert.equal(validPath(path), false, path);
  const p = newProject();
  assert.throws(
    () => parseProject({ ...p, files: { ...p.files, "MAIN.py": "x" } }),
    /dvostruka/,
  );
  assert.throws(
    () =>
      importProject(
        zipSync({ "project.json": strToU8("{}"), "../x.py": strToU8("x") }),
        "p.zip",
      ),
    /putanja/,
  );
});
test("file and decompressed archive sizes are bounded", () => {
  const p = newProject();
  p.files["main.py"] = "a".repeat(LIMITS.fileBytes + 1);
  assert.throws(() => parseProject(p), /128 KiB/);
  assert.throws(
    () =>
      importProject(
        zipSync({
          "project.json": strToU8("{}"),
          "main.py": strToU8("x".repeat(200000)),
        }),
        "p.zip",
      ),
    /veličinu/,
  );
  assert.throws(
    () => importProject(new Uint8Array(LIMITS.archiveBytes + 1), "p.zip"),
    /prevelika/,
  );
});
test("ZIP manifest must match files; truncated packages are rejected", () => {
  const p = newProject(),
    m = { ...p, files: [{ path: "main.py" }] };
  assert.throws(
    () =>
      importProject(
        zipSync({ "project.json": strToU8(JSON.stringify(m)) }),
        "p.zip",
      ),
    /podudaraju/,
  );
  assert.throws(
    () =>
      importProject(
        zipSync({
          "project.json": strToU8(JSON.stringify(m)),
          "main.py": strToU8(""),
          "extra.py": strToU8(""),
        }),
        "p.zip",
      ),
    /manifestu/,
  );
  const bytes = exportZip(p);
  assert.throws(() =>
    importProject(bytes.slice(0, bytes.length - 30), "p.zip"),
  );
});
test("editing preserves immutable runtime snapshot", () => {
  const p = newProject(),
    snapshot = clone(p),
    next = editProject(p, (n) => {
      n.files["main.py"] = "print(42)";
      n.settings.theme = "dark";
    });
  assert.deepEqual(snapshot, p);
  assert.equal(next.revision, 1);
  assert.notEqual(next.files["main.py"], p.files["main.py"]);
});
test("IndexedDB survives reopening with multiple projects, settings and history", async () => {
  const name = "test-" + crypto.randomUUID();
  let store = await ProjectStore.open(name);
  const p = newProject('print("A")', "A");
  let row = await store.save(p, 0, "Početno");
  const next = editProject(p, (n) => {
    n.files["pomoc.py"] = "X=42";
    n.settings.activeFile = "pomoc.py";
    n.settings.theme = "dark";
  });
  row = await store.save(next, row.storageRevision, "Pomoćna datoteka");
  const other = newProject('print("B")', "B");
  await store.save(other, 0, "Drugi projekt");
  await store.select(p.id);
  store.close();
  store = await ProjectStore.open(name);
  assert.equal(await store.active(), p.id);
  assert.equal((await store.list()).length, 2);
  row = (await store.get(p.id))!;
  assert.deepEqual(row.document, next);
  assert.equal(row.history.length, 2);
  assert.deepEqual(row.history[0].project, p);
  store.close();
});
test("atomic revisions protect against concurrent tab writes", async () => {
  const name = "test-" + crypto.randomUUID(),
    a = await ProjectStore.open(name),
    b = await ProjectStore.open(name),
    p = newProject();
  await a.save(p, 0, "Početno");
  const result = await Promise.allSettled([
    a.save(
      editProject(p, (n) => {
        n.title = "A";
      }),
      1,
      "A",
    ),
    b.save(
      editProject(p, (n) => {
        n.title = "B";
      }),
      1,
      "B",
    ),
  ]);
  assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
  const failure = result.find((r) => r.status === "rejected");
  assert.ok(
    failure?.status === "rejected" && failure.reason instanceof ConflictError,
  );
  assert.equal((await a.get(p.id))!.storageRevision, 2);
  a.close();
  b.close();
});
test("bounded history restoration creates a new revision", async () => {
  const store = await ProjectStore.open("test-" + crypto.randomUUID());
  let p = newProject(),
    row = await store.save(p, 0, "Početno");
  for (let i = 0; i < 34; i++) {
    p = editProject(p, (n) => {
      n.files["main.py"] = `print(${i})`;
    });
    row = await store.save(p, row.storageRevision, "Izmjena");
  }
  assert.equal(row.history.length, 30);
  const older = clone(row.history[0].project);
  p = editProject(p, (n) => {
    n.files = older.files;
  });
  row = await store.save(p, row.storageRevision, "Vraćena verzija");
  assert.equal(row.document.revision, 35);
  assert.deepEqual(row.document.files, older.files);
  store.close();
});
