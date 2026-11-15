import { useEffect, useRef, useState } from "react";
import {
  clone,
  editProject,
  forkProject,
  newProject,
  type Project,
} from "../project/model";
import {
  ProjectStore,
  ConflictError,
  readRecovery,
  writeRecovery,
  clearRecovery,
  type Stored,
} from "../project/storage";
import { basicExamples, exampleCircuit } from "../circuit/examples";
export function useWorkspace(notify: (message: string) => void) {
  const [project, setProject] = useState<Project>(),
    [record, setRecord] = useState<Stored>(),
    [status, setStatus] = useState("loading"),
    [error, setError] = useState(""),
    [undoCount, setUndoCount] = useState(0),
    [redoCount, setRedoCount] = useState(0);
  const current = useRef<Project>(undefined),
    db = useRef<ProjectStore>(undefined),
    expected = useRef(0),
    saved = useRef(""),
    label = useRef("Izmjena projekta"),
    queue = useRef<Promise<unknown>>(Promise.resolve());
  const undoStack = useRef<Project[]>([]),
    redoStack = useRef<Project[]>([]),
    lastEdit = useRef({ label: "", time: 0 });
  const show = (p: Project) => {
    current.current = p;
    setProject(p);
  };
  function install(row: Stored) {
    expected.current = row.storageRevision;
    saved.current = `${row.id}:${row.document.revision}`;
    setRecord(row);
    show(row.document);
    undoStack.current = [];
    redoStack.current = [];
    setUndoCount(0);
    setRedoCount(0);
    setStatus("saved");
    setError("");
  }
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const store = await ProjectStore.open();
        if (cancelled) {
          store.close();
          return;
        }
        db.current = store;
        const id = await store.active();
        let row = id ? await store.get(id) : undefined;
        const recovery = readRecovery();
        if (
          recovery &&
          (!row ||
            JSON.stringify(recovery.document) !== JSON.stringify(row.document))
        ) {
          row =
            row &&
            recovery.document.id === row.id &&
            recovery.expected === row.storageRevision
              ? await store.save(
                  recovery.document,
                  row.storageRevision,
                  "Oporavak nakon zatvaranja",
                )
              : await store.save(
                  forkProject(recovery.document, " — oporavak"),
                  0,
                  "Oporavljena kopija",
                );
          notify("Vraćene su nespremljene izmjene prethodne sesije.");
        }
        if (!row) {
          const initial = newProject(basicExamples.button.code,basicExamples.button.title);
          initial.circuit = exampleCircuit("button");
          initial.settings.example = "basic-button";
          row = await store.save(
            initial,
            0,
            "Početni projekt",
          );
        }
        if (!cancelled) {
          install(row);
          if (recovery) clearRecovery(recovery.document);
        }
      } catch (e) {
        if (cancelled) return;
        show(readRecovery()?.document ?? newProject());
        setStatus("error");
        setError(
          "Lokalno spremanje nije dostupno. Sačuvaj projekt izvozom ZIP paketa. " +
            (e as Error).message,
        );
      }
    })();
    return () => {
      cancelled = true;
      db.current?.close();
    };
  }, []);
  function persist(): Promise<void> {
    const run = queue.current
      .catch(() => {})
      .then(async () => {
        const p = current.current;
        if (!p || saved.current === `${p.id}:${p.revision}`) return;
        if (!db.current)
          throw Error("Lokalno spremanje nije dostupno. Izvezi ZIP paket.");
        setStatus("saving");
        try {
          const row = await db.current.save(p, expected.current, label.current);
          expected.current = row.storageRevision;
          saved.current = `${p.id}:${p.revision}`;
          setRecord(row);
          setError("");
          if (
            current.current?.id === p.id &&
            current.current.revision === p.revision
          ) {
            setStatus("saved");
            clearRecovery(p);
          } else {
            setStatus("pending");
            try {
              if (current.current)
                writeRecovery(current.current, expected.current);
            } catch {}
          }
        } catch (e) {
          setStatus(e instanceof ConflictError ? "conflict" : "error");
          setError((e as Error).message);
          throw e;
        }
      });
    queue.current = run;
    return run;
  }
  async function flush() {
    await persist();
    if (
      current.current &&
      saved.current !== `${current.current.id}:${current.current.revision}`
    )
      await persist();
  }
  useEffect(() => {
    if (!project || saved.current === `${project.id}:${project.revision}`)
      return;
    try {
      writeRecovery(project, expected.current);
    } catch {}
    const timer = setTimeout(() => {
      void persist().catch(() => {});
    }, 700);
    return () => clearTimeout(timer);
  }, [project]);
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      const p = current.current;
      if (p && saved.current !== `${p.id}:${p.revision}`) {
        try {
          writeRecovery(p, expected.current);
        } catch {}
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", before);
    const suspend = () => {
      const p = current.current;
      if (p && saved.current !== `${p.id}:${p.revision}`) {
        try { writeRecovery(p, expected.current); } catch {}
        void persist().catch(() => {});
      }
    };
    const visibility = () => { if (document.visibilityState === 'hidden') suspend(); };
    window.addEventListener('pagehide', suspend);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener("beforeunload", before);
      window.removeEventListener('pagehide', suspend);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  function change(description: string, update: (p: Project) => void) {
    const p = current.current;
    if (!p) return false;
    try {
      const next = editProject(p, update),
        now = Date.now();
      if (
        !description.startsWith("Uređivanje ") ||
        lastEdit.current.label !== description ||
        now - lastEdit.current.time > 1200
      ) {
        undoStack.current.push(clone(p));
        if (undoStack.current.length > 40) undoStack.current.shift();
      }
      lastEdit.current = { label: description, time: now };
      redoStack.current = [];
      setUndoCount(undoStack.current.length);
      setRedoCount(0);
      label.current = description;
      show(next);
      setStatus("pending");
      return true;
    } catch (e) {
      show(clone(p));
      notify((e as Error).message);
      return false;
    }
  }
  function travel(redo: boolean) {
    const p = current.current;
    if (!p) return;
    const from = redo ? redoStack.current : undoStack.current,
      to = redo ? undoStack.current : redoStack.current,
      target = from.pop();
    if (!target) return;
    to.push(clone(p));
    const next = clone(target);
    next.revision = p.revision + 1;
    next.updatedAt = new Date().toISOString();
    label.current = redo ? "Ponovljena izmjena" : "Poništena izmjena";
    show(next);
    setStatus("pending");
    lastEdit.current = { label: "", time: 0 };
    setUndoCount(undoStack.current.length);
    setRedoCount(redoStack.current.length);
  }
  async function add(p: Project, rescue = false) {
    if (!db.current)
      throw Error(
        "Lokalno spremanje nije dostupno. Izvezi trenutačni projekt.",
      );
    if (!rescue) await flush();
    else await queue.current.catch(() => {});
    const old = current.current;
    const row = await db.current.save(p, 0, "Novi projekt");
    install(row);
    if (old) clearRecovery(old);
  }
  async function open(id: string, discard = false) {
    if (!db.current) throw Error("Lokalno spremanje nije dostupno.");
    if (!discard) await flush();
    else await queue.current.catch(() => {});
    const row = await db.current.get(id);
    if (!row) throw Error("Projekt nije pronađen.");
    const old = current.current;
    await db.current.select(id);
    install(row);
    if (old) clearRecovery(old);
  }
  return {
    project,
    record,
    status,
    error,
    change,
    flush,
    add,
    open,
    list: () => db.current?.list() ?? Promise.resolve([]),
    undo: () => travel(false),
    redo: () => travel(true),
    undoCount,
    redoCount,
    rescue: () =>
      current.current
        ? add(forkProject(current.current, " — kopija"), true)
        : Promise.resolve(),
  };
}
