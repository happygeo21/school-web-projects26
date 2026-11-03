// Production review only; does not activate or alter any live server.
export function validatePilotSchool(school) {
  if (typeof school !== 'string' || !/^S[1-7]$/.test(school)) throw Error('Explicit single pilot school required');
  return school;
}
export function pilotRecordsAccess(school, call) {
  validatePilotSchool(school);
  return async (action, p, actor) => {
    const deny = () => { throw {code:'media/permission'}; };
    if (!['read','public','create','review'].includes(action)) deny();
    if (p.school !== undefined && p.school !== school) deny();
    if (['create','review'].includes(action) && p.school !== school) deny();
    const scoped = actor.teacher ? {...actor, schools:(actor.schools || []).filter(s => s === school)} : actor;
    if (action !== 'public' && scoped.teacher && !scoped.schools.length) deny();
    const rows = await call(action, p, scoped);
    return Array.isArray(rows) ? rows.filter(row => row.school === school) : rows;
  };
}
