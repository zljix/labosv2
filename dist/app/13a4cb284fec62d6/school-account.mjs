const $ = selector => document.querySelector(selector);
const roles = {student: 'Učenik', teacher: 'Nastavnik', admin: 'Administrator'};
let token = '', user = null, users = [], busy = false;
const message = (text, error = false) => { $('#account-message').textContent = text; $('#account-message').classList.toggle('error', error); };

async function request(action, body) {
  const response = await fetch('./api/index.php?action=' + action, {
    method: body === undefined ? 'GET' : 'POST', cache: 'no-store', credentials: 'same-origin',
    headers: body === undefined ? {} : {'Content-Type': 'application/json', 'X-CSRF-Token': token},
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
  let state;
  try { state = await response.json(); } catch { throw Error('Školska prijava nije dostupna na ovoj adresi.'); }
  if (state?.application !== 'labosv2') throw Error('Školska prijava nije dostupna na ovoj adresi.');
  if (state.csrfToken) token = state.csrfToken;
  if (!response.ok) {
    if (response.status === 401 && user) { user = null; render(); }
    throw Error(state.error?.message ?? 'Zahtjev nije uspio.');
  }
  return state;
}

function render() {
  $('#login-form').hidden = !!user;
  $('#signed-in').hidden = !user;
  $('#account-management').hidden = !user || user.mustChangePassword || user.role === 'student';
  $('#create-user-form').closest('details').hidden = user?.role !== 'admin';
  $('#update-user-form').closest('details').hidden = user?.role !== 'admin';
  if (!user) { users = []; $('#users-body').replaceChildren(); return; }
  $('#signed-name').textContent = user.displayName;
  $('#signed-role').textContent = roles[user.role];
  $('#password-form input[name=username]').value = user.username;
  $('#password-heading').textContent = user.mustChangePassword ? 'Postavi svoju lozinku prije nastavka' : 'Promijeni lozinku';
  $('#first-password-note').hidden = !user.mustChangePassword;
  $('#return-lab').hidden = user.mustChangePassword;
}

function drawUsers() {
  const fragment = document.createDocumentFragment();
  const needle = $('#user-search').value.trim().toLocaleLowerCase('hr');
  for (const person of users.filter(person => (person.displayName + ' ' + person.username).toLocaleLowerCase('hr').includes(needle))) {
    const tr = document.createElement('tr');
    for (const text of [person.displayName, person.username, roles[person.role], !person.active ? 'Neaktivan' : person.mustChangePassword ? 'Promjena lozinke obvezna' : 'Aktivan']) {
      const td = document.createElement('td'); td.textContent = text; tr.append(td);
    }
    fragment.append(tr);
  }
  $('#users-body').replaceChildren(fragment);
  for (const select of [$('#reset-user'), $('#update-user')]) {
    select.replaceChildren();
    const prompt = document.createElement('option'); prompt.value = ''; prompt.textContent = 'Odaberi korisnika'; select.append(prompt);
    for (const person of users.filter(person => person.id !== user.id)) {
      const option = document.createElement('option'); option.value = String(person.id); option.textContent = person.displayName + ' (' + person.username + ')'; select.append(option);
    }
  }
  $('#users-note').textContent = users.length === 0 ? 'Nema dodijeljenih učenika. Upravljanje razredima dolazi u sljedećoj etapi.' : 'Prikazano računa: ' + users.length + (users.length === 1000 ? ' (najviše 1000 po pregledu).' : '.');
}

async function reloadUsers() {
  if (user && !user.mustChangePassword && user.role !== 'student') { users = (await request('users')).users; drawUsers(); }
}

async function run(work) {
  if (busy) return; busy = true; const buttons = [...$('#account').querySelectorAll('button')]; buttons.forEach(button => button.disabled = true);
  message('Obrađujem zahtjev…');
  try { await work(); } catch (error) { message(error.message || 'Školski servis nije dostupan.', true); }
  finally { busy = false; buttons.forEach(button => button.disabled = false); }
}

function form(id, work) {
  $(id).addEventListener('submit', event => {
    event.preventDefault(); const element = event.currentTarget; const fields = Object.fromEntries(new FormData(element));
    void run(async () => { await work(fields); element.reset(); });
  });
}

form('#login-form', async body => {
  user = (await request('login', body)).user; render(); await reloadUsers();
  message(user.mustChangePassword ? 'Prijava je uspjela. Sada postavi svoju lozinku.' : 'Prijavljen/a si školskim računom.');
});
form('#password-form', async body => {
  if (body.newPassword !== body.repeatPassword) throw Error('Ponovljena nova lozinka nije jednaka.');
  user = (await request('password', {currentPassword: body.currentPassword, newPassword: body.newPassword})).user;
  render(); await reloadUsers(); message('Lozinka je promijenjena. Ostale prijave ovog računa više ne vrijede.');
});
form('#create-user-form', async body => {
  await request('create-user', body); await reloadUsers(); message('Račun je stvoren. Korisniku osobno predaj privremenu lozinku; mora je promijeniti pri prijavi.');
});
form('#reset-password-form', async body => {
  const state = await request('reset-password', {...body, id: Number(body.id)}); await reloadUsers(); message(state.message);
});
form('#update-user-form', async body => {
  await request('update-user', {id: Number(body.id), role: body.role, active: body.active === 'on'}); await reloadUsers(); message('Ovlasti i aktivnost računa su spremljene. Prethodne prijave tog računa više ne vrijede.');
});
$('#user-search').addEventListener('input', drawUsers);
$('#update-user').addEventListener('change', event => {
  const target = users.find(person => person.id === Number(event.target.value));
  if (target) { $('#update-role').value = target.role; $('#update-active').checked = target.active; }
});
$('#logout').addEventListener('click', () => void run(async () => {
  await request('logout', {}); user = null; token = ''; render();
  token = (await request('session')).csrfToken; message('Odjavljen/a si.');
}));

try {
  const state = await request('session'); user = state.user; render(); await reloadUsers();
  $('#account-status').textContent = 'Školska prijava je dostupna.';
  $('#account-controls').hidden = false;
  message(user ? 'Prijavljen/a si školskim računom.' : 'Prijavi se računom koji ti je dodijelila škola.');
} catch (error) {
  $('#account-status').textContent = 'Prijava nije dostupna: ' + error.message;
  $('#account-offline').hidden = false;
}
