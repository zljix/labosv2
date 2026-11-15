// Liveness describes shipped capabilities; it must never claim database readiness.
export function assertSchoolLiveness(data, profile) {
  if (data?.application !== 'labosv2' || data.status !== 'alive' || data.stage !== profile.stage) throw Error('PHP handler ne vraća očekivano školsko izdanje.');
  for (const name of ['accounts', 'classes', 'assignments', 'centralStorage', 'officialGrading', 'submissions', 'reports']) {
    if (data.features?.[name] !== profile.features[name]) throw Error('Neusklađen opseg PHP izdanja: ' + name + '.');
  }
  if (Object.hasOwn(data, 'database') || Object.hasOwn(data, 'ready')) throw Error('Javni liveness ne smije tvrditi spremnost baze.');
}
