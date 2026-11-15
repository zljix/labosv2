import { zipSync, unzipSync, strToU8 } from "fflate";
import { LIMITS, parseProject, validPath, type Project } from "./model";
const decoder = new TextDecoder("utf-8", { fatal: true });
export function exportZip(project: Project) {
  const p = parseProject(project);
  const manifest = {
    ...p,
    files: Object.keys(p.files).map((path) => ({ path })),
  };
  const entries: Record<string, Uint8Array> = {
    "project.json": strToU8(JSON.stringify(manifest, null, 2)),
  };
  for (const [path, text] of Object.entries(p.files))
    entries[path] = strToU8(text);
  return zipSync(entries, { level: 6 });
}
export function importProject(bytes: Uint8Array, filename: string): Project {
  if (bytes.length > LIMITS.archiveBytes)
    throw Error("Datoteka je prevelika. Najviše 2 MiB po paketu.");
  if (filename.toLowerCase().endsWith(".json"))
    return parseProject(JSON.parse(decoder.decode(bytes)));
  if (!filename.toLowerCase().endsWith(".zip"))
    throw Error("Odaberi ZIP paket ili JSON projekt.");
  let total = 0;
  const seen = new Set<string>();
  const entries = unzipSync(bytes, {
    filter: (file) => {
      if (file.name.endsWith("/")) {
        if (!/^(?:[A-Za-z_][A-Za-z0-9_-]*\/)+$/.test(file.name))
          throw Error("Neispravna mapa u paketu.");
        return false;
      }
      if (
        (file.name !== "project.json" && !validPath(file.name)) ||
        seen.has(file.name.toLowerCase())
      )
        throw Error("Nedopuštena ili dvostruka putanja u paketu.");
      seen.add(file.name.toLowerCase());
      total += file.originalSize;
      if (
        seen.size > LIMITS.files + 1 ||
        file.originalSize >
          (file.name === "project.json" ? 2228224 : LIMITS.fileBytes) ||
        total > LIMITS.totalBytes + 2228224
      )
        throw Error("Raspakirani sadržaj prelazi dopuštenu veličinu.");
      return true;
    },
  });
  if (!entries["project.json"]) throw Error("Nedostaje project.json.");
  const manifest = JSON.parse(decoder.decode(entries["project.json"]));
  if (!Array.isArray(manifest.files) || manifest.files.length > LIMITS.files)
    throw Error("Neispravan popis datoteka.");
  const files: Record<string, string> = {};
  for (const item of manifest.files) {
    if (
      !item ||
      typeof item.path !== "string" ||
      !validPath(item.path) ||
      Object.hasOwn(files, item.path) ||
      !Object.hasOwn(entries, item.path)
    )
      throw Error("Manifest i datoteke se ne podudaraju.");
    files[item.path] = decoder.decode(entries[item.path]);
  }
  if (Object.keys(entries).length !== Object.keys(files).length + 1)
    throw Error("Paket sadrži datoteke koje nisu u manifestu.");
  return parseProject({ ...manifest, files });
}
export function download(
  filename: string,
  data: string | Uint8Array,
  mime: string,
) {
  const blob = new Blob(
    [typeof data === "string" ? data : new Uint8Array(data).buffer],
    { type: mime },
  );
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: filename,
  });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
export const safeFilename = (title: string) =>
  title.replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 70) || "ESP32_projekt";
