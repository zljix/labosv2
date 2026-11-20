import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {createServer} from 'node:net';
import {randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

test('23B accounts against real PHP and a disposable restricted MySQL database', {timeout: 120000}, async t => {
  const php = process.env.PHP_BIN || 'php';
  const dsn = process.env.LAB_TEST_DB_DSN || '';
  assert.match(dsn, /^mysql:host=[^;]+;port=\d+;dbname=labosv2_test_[a-z0-9_]+;charset=utf8mb4$/, 'Provide LAB_TEST_DB_DSN for a disposable labosv2_test_* MySQL 8.4 database.');
  assert(process.env.LAB_TEST_DB_USER, 'Provide its restricted LAB_TEST_DB_USER.');
  const root = mkdtempSync(resolve('.build/accounts-test-'));
  const pkg = join(root, 'package'); cpSync(resolve('.build/school-package'), pkg, {recursive: true});
  mkdirSync(join(root, 'sessions'), {mode: 0o700});
  const socket = createServer(); await new Promise(done => socket.listen(0, '127.0.0.1', done));
  const port = socket.address().port; await new Promise(done => socket.close(done));
  const origin = 'http://127.0.0.1:' + port;
  const config = {database: {dsn, user: process.env.LAB_TEST_DB_USER, password: process.env.LAB_TEST_DB_PASSWORD ?? ''}, timezone: 'Europe/Zagreb', app: {origin, key: randomBytes(32).toString('hex'), session_directory: join(root, 'sessions'), allow_insecure_localhost: true}};
  writeFileSync(join(root, 'private.json'), JSON.stringify(config), {mode: 0o600});
  const configPath = join(root, 'config.php'); writeFileSync(configPath, '<?php return json_decode(file_get_contents(__DIR__ . "/private.json"), true, 32, JSON_THROW_ON_ERROR);\n', {mode: 0o600});
  const env = {...process.env, LAB_SCHOOL_CONFIG: configPath, LAB_TEST_BOOTSTRAP: join(pkg, 'app/bootstrap.php')};
  const consoleCommand = (action, input) => spawnSync(php, [join(pkg, 'tools/console.php'), action, configPath], {input: input === undefined ? '' : JSON.stringify(input), encoding: 'utf8', env});
  const sql = (statement, values = []) => {
    const result = spawnSync(php, ['-r', 'require getenv("LAB_TEST_BOOTSTRAP"); $input=json_decode(stream_get_contents(STDIN),true); $pdo=Labos\\database(Labos\\configuration()); $q=Labos\\query($pdo,$input["sql"],$input["values"]); echo json_encode($q->columnCount() ? $q->fetchAll() : []);'], {input: JSON.stringify({sql: statement, values}), encoding: 'utf8', env});
    assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout);
  };
  let server;
  t.after(() => { if (server) { try { process.kill(-server.pid, 'SIGTERM'); } catch { server.kill(); } } rmSync(root, {recursive: true, force: true}); });
  const adminPassword = 'Admin ' + randomBytes(10).toString('hex');
  const temporary = 'Temp ' + randomBytes(10).toString('hex');
  const nextPassword = 'Moja nova ' + randomBytes(10).toString('hex');
  let admin, teacher, student, outsider, teacherUser, studentUser, outsiderUser;
  function client(cookie = '') {
    let csrf = '';
    return {
      get cookie() { return cookie; }, get csrf() { return csrf; },
      async call(action, body, headers = {}) {
        const response = await fetch(origin + '/api/index.php?action=' + action, {method: body === undefined ? 'GET' : 'POST', headers: {Cookie: cookie, ...(body === undefined ? {} : {'Content-Type': 'application/json', 'X-CSRF-Token': csrf, Origin: origin}), ...headers}, body: body === undefined ? undefined : JSON.stringify(body)});
        const set = response.headers.getSetCookie();
        if (set.length) cookie = set.at(-1).split(';')[0];
        const text = await response.text(); let json; try { json = JSON.parse(text); } catch { assert.fail('Non-JSON API response: ' + text.slice(0, 150)); }
        if (json.csrfToken) csrf = json.csrfToken;
        return {status: response.status, headers: response.headers, json, text};
      },
      async login(name, pass) { await this.call('session'); return this.call('login', {username: name, password: pass}); },
    };
  }

  await t.test('migrations are repeatable and never recreate accounts', () => {
    const first = consoleCommand('migrate'); assert.equal(first.status, 0, first.stderr); assert.equal(JSON.parse(first.stdout).migrations.length, 8);
    assert(JSON.parse(first.stdout).migrations.every(item => item.status === 'applied'));
    const second = consoleCommand('migrate'); assert.equal(second.status, 0, second.stderr); assert(JSON.parse(second.stdout).migrations.every(item => item.status === 'already_applied'));
  });
  await t.test('bootstrap creates one administrator and permanently closes initialization', () => {
    const first = consoleCommand('init-admin', {username: 'Admin.Skola', displayName: 'Administrator škole', password: adminPassword}); assert.equal(first.status, 0, first.stderr);
    assert.equal(JSON.parse(first.stdout).user.username, 'admin.skola');
    const second = consoleCommand('init-admin', {username: 'second.admin', displayName: 'Drugi admin', password: temporary}); assert.equal(second.status, 2); assert.match(second.stderr, /already_initialized/);
    assert.equal(sql('SELECT COUNT(*) AS n FROM users')[0].n, 1);
  });
  await t.test('checksum mismatch blocks edited migrations without losing existing users', () => {
    const path = join(pkg, 'migrations/001_accounts.sql'), original = readFileSync(path, 'utf8'); writeFileSync(path, original + '\n-- changed\n');
    const changed = consoleCommand('migrate'); assert.equal(changed.status, 2); assert.match(changed.stderr, /migration_changed/); writeFileSync(path, original);
    assert.equal(sql('SELECT COUNT(*) AS n FROM users')[0].n, 1);
  });
  // The PHP development server otherwise falls back to index.html for missing
  // paths. Match Apache's ordinary file serving without a SPA fallback here.
  const router = join(root, 'router.php');
  writeFileSync(router, '<?php $path=parse_url($_SERVER["REQUEST_URI"],PHP_URL_PATH); if (!is_file($_SERVER["DOCUMENT_ROOT"] . $path)) {http_response_code(404); exit;} return false;');
  server = spawn(php, ['-S', '127.0.0.1:' + port, '-t', join(pkg, 'web'), router], {env: {...env, PHP_CLI_SERVER_WORKERS: '4'}, detached: true, stdio: ['ignore', 'ignore', 'pipe']});
  let serverLog = ''; server.stderr.on('data', bytes => { serverLog += bytes; });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin + '/api/health.php')).ok) break; } catch {} await delay(30); }
  await t.test('anonymous access, methods, body size and CSRF fail safely', async () => {
    const c = client(); const state = await c.call('session'); assert.equal(state.status, 200, state.text); assert.equal(state.json.user, null); assert.match(c.csrf, /^[a-f0-9]{64}$/);
    assert.match(state.headers.get('set-cookie'), /HttpOnly/i); assert.match(state.headers.get('set-cookie'), /SameSite=Strict/i); assert.equal(state.headers.get('cache-control'), 'no-store, private');
    assert.equal((await c.call('users')).status, 401); assert.equal((await c.call('login')).status, 405);
    assert.equal((await c.call('login', {username: 'admin.skola', password: adminPassword}, {'X-CSRF-Token': 'forged'})).status, 403);
    assert.equal((await c.call('login', {}, {Origin: 'https://elsewhere.example'})).status, 403);
    assert.equal((await c.call('login', {}, {'Content-Type': 'text/plain'})).status, 415);
    assert.equal((await c.call('login', {filler: 'x'.repeat(9000)})).status, 413);
    assert.equal((await c.call('init-admin', {})).status, 404);
  });
  await t.test('login rotates the session ID and cannot take a role from the browser', async () => {
    admin = client('LABOSV2SESSID=attackerchosen1234567890123456'); await admin.call('session'); const before = admin.cookie;
    assert(!before.includes('attackerchosen'));
    const result = await admin.call('login', {username: 'ADMIN.SKOLA', password: adminPassword, role: 'student'}); assert.equal(result.status, 200, result.text); assert.equal(result.json.user.role, 'admin'); assert.notEqual(admin.cookie, before);
    assert.equal(result.json.user.mustChangePassword, false); assert(!result.text.includes('password_hash'));
  });
  await t.test('administrator creates named roles with hashed temporary passwords', async () => {
    const make = async (username, role, displayName) => {
      const result = await admin.call('create-user', {username, role, displayName, temporaryPassword: temporary}); assert.equal(result.status, 201, result.text); assert(result.json.user.mustChangePassword); return result.json.user;
    };
    teacherUser = await make('teacher.one', 'teacher', 'Nastavnik Jedan'); studentUser = await make('student.one', 'student', 'Učenik Jedan'); outsiderUser = await make('student.two', 'student', '<img src=x onerror=alert(1)>');
    assert.equal((await admin.call('create-user', {username: 'STUDENT.ONE', role: 'student', displayName: 'Duplikat', temporaryPassword: temporary})).status, 409);
    const stored = sql('SELECT password_hash FROM users'); assert(stored.every(row => row.password_hash !== temporary && /^\$2y\$/.test(row.password_hash)));
  });
  await t.test('first login requires a real password change before privileged actions', async () => {
    teacher = client(); const result = await teacher.login('teacher.one', temporary); assert.equal(result.status, 200, result.text);
    assert.equal((await teacher.call('users')).json.error.code, 'password_change_required');
    assert.equal((await teacher.call('password', {currentPassword: 'wrong', newPassword: nextPassword})).status, 403);
    assert.equal((await teacher.call('password', {currentPassword: temporary, newPassword: 'short'})).status, 422);
    const changed = await teacher.call('password', {currentPassword: temporary, newPassword: nextPassword}); assert.equal(changed.status, 200, changed.text); assert.equal(changed.json.user.mustChangePassword, false);
  });
  await t.test('students cannot enumerate accounts, read another profile or grant a role', async () => {
    student = client(); outsider = client(); await student.login('student.one', temporary); await outsider.login('student.two', temporary);
    await student.call('password', {currentPassword: temporary, newPassword: nextPassword}); await outsider.call('password', {currentPassword: temporary, newPassword: nextPassword});
    assert.equal((await student.call('users')).status, 403);
    assert.equal((await student.call('user&id=' + studentUser.id)).status, 200);
    assert.equal((await student.call('user&id=' + outsiderUser.id)).status, 403);
    assert.equal((await student.call('create-user', {role: 'admin'})).status, 403);
    assert.equal((await student.call('update-user', {id: studentUser.id, role: 'admin', active: true})).status, 403);
    assert.equal((await student.call('reset-password', {id: teacherUser.id, temporaryPassword: temporary})).status, 403);
  });
  await t.test('teacher access and reset are confined to students in an assigned class', async () => {
    assert.equal((await teacher.call('users')).json.users.length, 0);
    assert.equal((await teacher.call('reset-password', {id: studentUser.id, temporaryPassword: temporary, currentPassword: nextPassword})).status, 403);
    sql("INSERT INTO school_classes (name, school_year) VALUES ('Test 4.f', '2026/2027')");
    const classId = sql("SELECT id FROM school_classes WHERE name = 'Test 4.f'")[0].id;
    sql('INSERT INTO class_teachers (class_id, teacher_id) VALUES (?, ?)', [classId, teacherUser.id]); sql('INSERT INTO class_students (class_id, student_id) VALUES (?, ?)', [classId, studentUser.id]);
    assert.deepEqual((await teacher.call('users')).json.users.map(person => person.id), [studentUser.id]);
    assert.equal((await teacher.call('user&id=' + outsiderUser.id)).status, 403);
    assert.equal((await teacher.call('reset-password', {id: outsiderUser.id, temporaryPassword: temporary, currentPassword: nextPassword})).status, 403);
    assert.equal((await teacher.call('reset-password', {id: studentUser.id, temporaryPassword: temporary, currentPassword: 'wrong'})).status, 403);
    assert.equal((await teacher.call('reset-password', {id: studentUser.id, temporaryPassword: temporary, currentPassword: nextPassword})).status, 200);
    assert.equal((await student.call('session')).json.user, null);
    const renewed = await student.login('student.one', temporary); assert(renewed.json.user.mustChangePassword);
    await student.call('password', {currentPassword: temporary, newPassword: nextPassword});
  });
  await t.test('changing a password revokes a second device while keeping this one signed in', async () => {
    const second = client(); assert.equal((await second.login('student.one', nextPassword)).status, 200);
    assert.equal((await student.call('password', {currentPassword: nextPassword, newPassword: nextPassword + '2'})).status, 200);
    assert.equal((await second.call('session')).json.user, null); assert.equal((await student.call('session')).json.user.id, studentUser.id);
  });
  await t.test('deactivation and role changes revoke sessions; self-demotion is refused', async () => {
    assert.equal((await admin.call('update-user', {id: 1, role: 'student', active: false})).status, 403);
    const change = await admin.call('update-user', {id: outsiderUser.id, role: 'student', active: false}); assert.equal(change.status, 200, change.text);
    assert.equal((await outsider.call('session')).json.user, null);
    const c = client(); assert.equal((await c.login('student.two', nextPassword)).status, 401);
    await admin.call('update-user', {id: outsiderUser.id, role: 'student', active: true});
    assert.equal((await c.login('student.two', nextPassword)).status, 200);
    await admin.call('update-user', {id: teacherUser.id, role: 'student', active: true});
    assert.equal((await teacher.call('users')).status, 401);
  });
  await t.test('unknown and wrong-password login share an error and concurrent attempts hit a persistent limit', async () => {
    const c = client(); await c.call('session'); const unknown = await c.call('login', {username: 'missing.one', password: temporary});
    const bad = await c.call('login', {username: 'admin.skola', password: 'wrong'}); assert.equal(unknown.json.error.code, bad.json.error.code); assert.equal(unknown.json.error.message, bad.json.error.message);
    const clients = await Promise.all(Array.from({length: 10}, async () => { const item = client(); await item.call('session'); return item; }));
    const results = await Promise.all(clients.map(item => item.call('login', {username: 'attack.target', password: 'wrong'})));
    assert.equal(results.filter(result => result.status === 401).length, 8); assert.equal(results.filter(result => result.status === 429).length, 2);
    const later = client(); await later.call('session'); assert.equal((await later.call('login', {username: 'attack.target', password: temporary})).status, 429);
  });
  await t.test('secure session parameters and idle/absolute expiry are enforced', async () => {
    const flags = spawnSync(php, ['-r', 'require getenv("LAB_TEST_BOOTSTRAP"); $c=Labos\\configuration(); $c["app"]["secure"]=true; $_SERVER["HTTPS"]="on"; Labos\\startSession($c); echo json_encode(session_get_cookie_params()); session_destroy();'], {env, encoding: 'utf8'});
    assert.equal(flags.status, 0, flags.stderr); const params = JSON.parse(flags.stdout);
    assert.equal(params.secure, true); assert.equal(params.httponly, true); assert.equal(params.samesite, 'Strict');
    for (const [field, seconds] of [['last_seen', 1801], ['started_at', 28801]]) {
      const c = client(); assert.equal((await c.login('student.one', nextPassword + '2')).status, 200);
      const id = c.cookie.split('=')[1]; assert.match(id, /^[a-zA-Z0-9,-]+$/);
      const path = join(root, 'sessions/sess_' + id); const content = readFileSync(path, 'utf8');
      writeFileSync(path, content.replace(new RegExp(field + '\\|i:\\d+;'), field + '|i:' + (Math.floor(Date.now() / 1000) - seconds) + ';'));
      assert.equal((await c.call('session')).json.user, null);
    }
  });
  await t.test('logout invalidates its session and audit has events without passwords', async () => {
    const old = student.cookie; assert.equal((await student.call('logout', {})).status, 200);
    assert.equal((await client(old).call('session')).json.user, null);
    const records = sql('SELECT event, details FROM audit_events'); assert(records.some(row => row.event === 'password.reset')); assert(records.some(row => row.event === 'account.updated'));
    assert(!JSON.stringify(records).includes(temporary)); assert(!JSON.stringify(records).includes(nextPassword));
    assert(!serverLog.includes(adminPassword)); assert(!serverLog.includes(temporary));
  });
  await t.test('migration re-run preserves all users and public web cannot read private files', async () => {
    const before = sql('SELECT id, username, password_hash FROM users ORDER BY id'); assert.equal(consoleCommand('migrate').status, 0); assert.deepEqual(sql('SELECT id, username, password_hash FROM users ORDER BY id'), before);
    for (const path of ['config.php', 'config/config.example.php', 'app/bootstrap.php', 'migrations/001_accounts.sql', 'tools/console.php']) assert.equal((await fetch(origin + '/' + path)).status, 404, path);
    const response = await fetch(origin + '/api/index.php?action=session'); const bytes = await response.text(); assert(!bytes.includes(config.database.password)); assert(!bytes.includes(config.app.key));
  });
});
