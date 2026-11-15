import {schoolPilotChecks, schoolPilotMetrics, schoolPilotSummary, createSchoolPilotRecord, importSchoolPilotRecord} from './school-pilot-record.mjs';

export function mountSchoolPilot(document, {download = saveFile, manifest = fetch('./offline-package.json', {cache: 'no-store'}).then(r => r.ok ? r.json() : null).catch(() => null)} = {}) {
  const form = document.querySelector('#pilot-form'), status = document.querySelector('#status'), summary = document.querySelector('#summary');
  const make = (tag, text) => { const node = document.createElement(tag); if (text) node.textContent = text; return node; };
  for (const [id, title] of schoolPilotChecks) {
    const row = make('div'); row.className = 'scenario'; row.append(make('p', title));
    const label = make('label', 'Rezultat'), select = make('select'); select.name = 'check-' + id;
    for (const [value, text] of [['untested', 'Nije provjereno'], ['pass', 'Prošlo'], ['fail', 'Nije prošlo'], ['blocked', 'Blokirano']]) {const option = make('option', text); option.value = value; select.append(option);}
    label.append(select); row.append(label);
    const notes = make('label', 'Postupak i opaženi rezultat'), area = make('textarea'); area.name = 'notes-' + id; area.rows = 2; area.maxLength = 3000; notes.append(area); row.append(notes);
    document.querySelector('#checks').append(row);
  }
  for (const [id, title] of schoolPilotMetrics) {const label = make('label', title), input = make('input'); input.name = id; input.type = 'number'; input.min = '0'; input.max = '86400000'; input.step = 'any'; label.append(input); document.querySelector('#metrics').append(label);}
  let generatedForVersion = 'unknown';
  Promise.resolve(manifest).then(value => {if (typeof value?.version === 'string') generatedForVersion = value.version;}).catch(() => {});
  const field = name => form.elements.namedItem(name);
  const read = () => {
    const data = {};
    for (const name of ['scope', 'date', 'releaseVersion', 'installation', 'server', 'devices', 'browsers', 'method', 'conclusion', 'target']) data[name] = field(name).value;
    data.students = field('students').value === '' ? NaN : Number(field('students').value);
    data.checks = Object.fromEntries(schoolPilotChecks.map(([id]) => [id, {status: field('check-' + id).value, notes: field('notes-' + id).value}]));
    data.metrics = Object.fromEntries(schoolPilotMetrics.map(([id]) => [id, field(id).value === '' ? null : Number(field(id).value)]));
    return data;
  };
  const update = () => {
    const report = schoolPilotSummary(read());
    summary.textContent = 'Prošlo: ' + report.pass + ' / ' + report.total + ' · Nije prošlo: ' + report.fail + ' · Blokirano: ' + report.blocked + ' · Nije provjereno: ' + report.untested + '.';
  };
  const fill = data => {
    for (const [key, value] of Object.entries(data)) if (!['checks', 'metrics'].includes(key) && field(key)) field(key).value = String(value);
    for (const [id, check] of Object.entries(data.checks)) {field('check-' + id).value = check.status; field('notes-' + id).value = check.notes;}
    for (const [id, value] of Object.entries(data.metrics)) field(id).value = value === null ? '' : String(value);
    update();
  };
  const reportError = error => {status.textContent = error.message; status.className = 'error';};
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const record = createSchoolPilotRecord(read(), generatedForVersion);
      download(record, 'Labosv2_skolski_pilot_' + (record.observations.date || 'nacrt') + '.json');
      status.textContent = 'Zapis je pripremljen za preuzimanje. Opažanja nisu automatska potvrda instalacije.'; status.className = '';
    } catch (error) {reportError(error);}
  });
  document.querySelector('#draft').addEventListener('click', () => {
    const data = {scope: 'development', students: 0, target: 'micropython', checks: {}, metrics: {}};
    download(createSchoolPilotRecord(data, generatedForVersion), 'Labosv2_skolski_pilot_prazan.json');
    status.textContent = 'Prazan obrazac je pripremljen za preuzimanje. Tvoj unos u stranici ostaje sačuvan.'; status.className = '';
  });
  document.querySelector('#record-file').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      if (file.size > 131072) throw Error('Zapis smije imati najviše 128 KiB.');
      const data = importSchoolPilotRecord(await file.text());
      fill(data); status.textContent = 'Zapis je učitan za nastavak opažanja.'; status.className = '';
    } catch (error) {reportError(error);}
    finally {event.target.value = '';}
  });
  update();
}

function saveFile(record, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2) + '\n'], {type: 'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
if (typeof document !== 'undefined' && document.querySelector('#pilot-form')) mountSchoolPilot(document);
