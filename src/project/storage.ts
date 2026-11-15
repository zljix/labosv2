import { clone, parseProject, type Project } from "./model";
export interface Snapshot {
  id: string;
  savedAt: string;
  label: string;
  project: Project;
}
export interface Stored {
  id: string;
  document: Project;
  storageRevision: number;
  history: Snapshot[];
}
export class ConflictError extends Error {
  constructor() {
    super(
      "Projekt je promijenjen u drugoj kartici. Spremi kao kopiju ili učitaj spremljenu verziju.",
    );
  }
}
const request = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
const complete = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? Error("Spremanje je prekinuto."));
    tx.onerror = () => {};
  });
export class ProjectStore {
  private constructor(private db: IDBDatabase) {}
  static async open(name = "esp32-micropython-lab-v2") {
    const r = indexedDB.open(name, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("projects", { keyPath: "id" });
      r.result.createObjectStore("meta");
    };
    const db = await request(r);
    db.onversionchange = () => db.close();
    return new ProjectStore(db);
  }
  async list(): Promise<Stored[]> {
    const tx = this.db.transaction("projects", "readonly"),
      done = complete(tx);
    const rows = await request<Stored[]>(tx.objectStore("projects").getAll());
    await done;
    return rows.sort((a, b) =>
      b.document.updatedAt.localeCompare(a.document.updatedAt),
    );
  }
  async get(id: string): Promise<Stored | undefined> {
    const tx = this.db.transaction("projects", "readonly"),
      done = complete(tx);
    const row = await request<Stored | undefined>(
      tx.objectStore("projects").get(id),
    );
    await done;
    if (row) row.document = parseProject(row.document);
    return row;
  }
  async active(): Promise<string | undefined> {
    const tx = this.db.transaction("meta", "readonly"),
      done = complete(tx);
    const id = await request<string | undefined>(
      tx.objectStore("meta").get("active"),
    );
    await done;
    return id;
  }
  async select(id: string) {
    const tx = this.db.transaction("meta", "readwrite"),
      done = complete(tx);
    tx.objectStore("meta").put(id, "active");
    await done;
  }
  async save(
    document: Project,
    expected: number,
    label: string,
  ): Promise<Stored> {
    const validated = parseProject(document);
    const tx = this.db.transaction(["projects", "meta"], "readwrite"),
      done = complete(tx),
      store = tx.objectStore("projects");
    const prior = await request<Stored | undefined>(store.get(document.id));
    if ((prior?.storageRevision ?? 0) !== expected) {
      tx.abort();
      await done.catch(() => {});
      throw new ConflictError();
    }
    const history = [
      ...(prior?.history ?? []),
      {
        id: crypto.randomUUID(),
        savedAt: new Date().toISOString(),
        label,
        project: clone(validated),
      },
    ].slice(-30);
    while (
      history.length > 1 &&
      JSON.stringify(history).length > 4 * 1024 * 1024
    )
      history.shift();
    const row = {
      id: document.id,
      document: validated,
      storageRevision: expected + 1,
      history,
    };
    store.put(row);
    tx.objectStore("meta").put(document.id, "active");
    await done;
    return row;
  }
  close() {
    this.db.close();
  }
}
export const RECOVERY_KEY = "esp32-lab-recovery-v2";
export function writeRecovery(document: Project, expected: number) {
  localStorage.setItem(RECOVERY_KEY, JSON.stringify({ document, expected }));
}
export function clearRecovery(p: Project) {
  try {
    const r = readRecovery();
    if (r && JSON.stringify(r.document) === JSON.stringify(parseProject(p)))
      localStorage.removeItem(RECOVERY_KEY);
  } catch {}
}
export function readRecovery():
  { document: Project; expected: number } | undefined {
  try {
    const r = JSON.parse(localStorage.getItem(RECOVERY_KEY) ?? "null");
    if (r && Number.isSafeInteger(r.expected))
      return { document: parseProject(r.document), expected: r.expected };
  } catch {}
}
