// A pilot record stores observations. It never certifies a deployment or awards points.
export const schoolPilotChecks = [
  ['login', 'Prijava i promjena privremene lozinke'],
  ['access', 'Učenik i nastavnik vide samo dopuštene radove'],
  ['save', 'Izmjene dobivaju potvrđenu reviziju'],
  ['review', 'Nastavnik vidi novu reviziju i dob podataka'],
  ['device', 'Nastavak na drugom računalu vraća isti rad'],
  ['conflict', 'Dvije kartice traže izbor sukobljenih verzija'],
  ['network', 'Prekid veze čuva lokalni rad i dopušta oporavak'],
  ['grading', 'Bodovi pripadaju točnoj spremljenoj reviziji'],
  ['failure', 'Kvar provjeravača ostavlja prazne bodove'],
  ['finish', 'Ponovljeni završetak stvara jednu zaključanu predaju'],
  ['rework', 'Dorada čuva raniju predaju i njezine bodove'],
  ['export', 'CSV i projektni ZIP odgovaraju evidenciji'],
  ['restore', 'Vraćena kopija čuva prijave, radove i bodove'],
  ['memory', 'Izmjereni su memorija i ograničenje servisa provjere'],
];
export const schoolPilotMetrics = [
  ['saveP95Ms', 'Spremanje · 95. percentil (ms)', 2000],
  ['reviewP95Ms', 'Pregled razreda · 95. percentil (ms)', 2000],
  ['visibilityMs', 'Vidljivost nove revizije nastavniku (ms)', 10000],
  ['gradeP95Ms', 'Potvrda bodova pri uobičajenom radu · 95. percentil (ms)', 15000],
  ['finishWaveMs', 'Završni val predaja do zadnjih potvrđenih bodova (ms)', null],
];
const statuses = ['untested', 'pass', 'fail', 'blocked'];
const scopes = ['development', 'school-small', 'school-class'];
const textLimits = {date: 10, releaseVersion: 80, installation: 200, server: 1000, devices: 1000, browsers: 1000, method: 3000, conclusion: 6000};
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function schoolPilotObservations(input) {
  if (!object(input)) throw Error('Nedostaju opažanja pilota.');
  const result = {};
  for (const [key, max] of Object.entries(textLimits)) {
    const value = input[key] ?? '';
    if (typeof value !== 'string' || value.length > max) throw Error('Nevaljano polje: ' + key + '.');
    result[key] = value.trim();
  }
  if (result.date && (!/^\d{4}-\d{2}-\d{2}$/.test(result.date) || !Number.isFinite(Date.parse(result.date)) || new Date(result.date).toISOString().slice(0, 10) !== result.date)) throw Error('Datum nije valjan kalendarski dan.');
  if (!scopes.includes(input.scope)) throw Error('Odaberi vrstu provjere.');
  result.scope = input.scope;
  if (!Number.isInteger(input.students) || input.students < 0 || input.students > 100) throw Error('Broj učenika mora biti cijeli broj od 0 do 100.');
  result.students = input.students;
  if (!['micropython', 'uno', 'nano'].includes(input.target)) throw Error('Odaberi provjereni cilj.');
  result.target = input.target;
  if (!object(input.checks) || Object.keys(input.checks).some(id => !schoolPilotChecks.some(([key]) => key === id))) throw Error('Nepoznata provjera pilota.');
  result.checks = {};
  for (const [id] of schoolPilotChecks) {
    const check = input.checks[id] ?? {status: 'untested', notes: ''};
    if (!object(check) || !statuses.includes(check.status) || typeof check.notes !== 'string' || check.notes.length > 3000) throw Error('Nevaljana provjera: ' + id + '.');
    if (check.status !== 'untested' && !check.notes.trim()) throw Error('Za zabilježenu provjeru opiši postupak i opaženi rezultat: ' + id + '.');
    result.checks[id] = {status: check.status, notes: check.notes.trim()};
  }
  if (!object(input.metrics)) throw Error('Nedostaje odjeljak mjerenja.');
  result.metrics = {};
  for (const [key] of schoolPilotMetrics) {
    const value = input.metrics[key] ?? null;
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 86400000)) throw Error('Mjerenje mora biti broj od 0 do 86400000 ms: ' + key + '.');
    result.metrics[key] = value;
  }
  const observed = Object.values(result.checks).some(check => check.status !== 'untested');
  if (observed) {
    for (const key of ['date', 'releaseVersion', 'installation', 'server', 'devices', 'browsers', 'method', 'conclusion']) if (!result[key]) throw Error('Za zapis opažanja popuni polje: ' + key + '.');
    if (result.scope !== 'development' && result.students < 1) throw Error('Školski pilot treba broj stvarno uključenih učenika.');
  }
  if (Object.values(result.metrics).some(value => value !== null) && !result.method) throw Error('Opiši način mjerenja, broj uzoraka i opterećenje.');
  return result;
}

export function schoolPilotSummary(observations) {
  const counts = {pass: 0, fail: 0, blocked: 0, untested: 0};
  for (const check of Object.values(observations.checks)) counts[check.status]++;
  return {scope: observations.scope, ...counts, total: schoolPilotChecks.length,
    allObservedPassed: counts.pass === schoolPilotChecks.length,
    metrics: schoolPilotMetrics.map(([id, , targetMs]) => ({id, valueMs: observations.metrics[id], targetMs,
      meetsTarget: targetMs === null || observations.metrics[id] === null ? null : observations.metrics[id] <= targetMs}))};
}

export function createSchoolPilotRecord(input, generatedForVersion, recordedAt = new Date().toISOString()) {
  if (typeof generatedForVersion !== 'string' || generatedForVersion.length > 80 || typeof recordedAt !== 'string' || !Number.isFinite(Date.parse(recordedAt))) throw Error('Nevaljani metapodaci zapisa.');
  const observations = schoolPilotObservations(input);
  const record = {format: 'labosv2-school-pilot', version: 1, generatedForVersion, recordedAt, authority: 'observer-entered',
    classification: Object.values(observations.checks).every(check => check.status === 'untested') ? 'draft' : 'observation',
    observations, summary: schoolPilotSummary(observations)};
  if (new TextEncoder().encode(JSON.stringify(record, null, 2) + '\n').length > 131072) throw Error('Cijeli zapis prelazi 128 KiB. Skrati opažanja prije preuzimanja.');
  return record;
}

export function importSchoolPilotRecord(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > 131072) throw Error('Zapis smije imati najviše 128 KiB.');
  let record;
  try { record = JSON.parse(text); } catch { throw Error('Datoteka nije valjan JSON.'); }
  if (!object(record) || record.format !== 'labosv2-school-pilot' || record.version !== 1 || typeof record.generatedForVersion !== 'string' || record.generatedForVersion.length > 80 || typeof record.recordedAt !== 'string' || !Number.isFinite(Date.parse(record.recordedAt))) throw Error('Nepodržan format ili metapodaci zapisa.');
  // Ignore imported classifications, summaries and claims of authority.
  return schoolPilotObservations(record.observations);
}
