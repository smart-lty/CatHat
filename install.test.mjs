import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { discoverDirectories, isBbProcess, layoutPaths } from './install.mjs';

const exec = promisify(execFile);
const installer = fileURLToPath(new URL('./install.mjs', import.meta.url));
const manifest = async location => JSON.parse(await readFile(path.join(location, 'package.json'), 'utf8'));
const writeJson = (filename, value) => writeFile(filename, JSON.stringify(value));

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'release-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const home = path.join(root, 'home');
  await mkdir(home);
  const env = { ...process.env, HOME: home, USERPROFILE: home, npm_config_cache: path.join(root, 'npm-cache'), npm_config_offline: 'true' };
  for (const name of Object.keys(env)) if (/^BB_/i.test(name)) delete env[name];
  const run = (...args) => exec(process.execPath, [installer, ...args], { env, timeout: 60_000 });
  return { root, home, env, run };
}

async function fakeOriginal(dataDir, layout) {
  await mkdir(layout, { recursive: true });
  await writeJson(path.join(layout, 'package.json'), { name: 'bb-app', version: '1.0.0' });
  await writeFile(path.join(dataDir, 'npm', 'original-shim'), 'original');
}

async function fixtureRelease(root, env) {
  const source = path.join(root, 'release source');
  await mkdir(path.join(source, 'release', 'plugins'), { recursive: true });
  await mkdir(path.join(source, 'theme'));
  const tempPackage = path.join(root, 'packed');
  await mkdir(path.join(tempPackage, 'dist'), { recursive: true });
  await writeFile(path.join(tempPackage, 'dist', 'bb-app.js'), '#!/usr/bin/env node\n');
  const checksums = {};
  async function pack(pkg, file) {
    await writeJson(path.join(tempPackage, 'package.json'), pkg);
    const npmArgs = ['pack', '--ignore-scripts', '--json'];
    const windows = process.platform === 'win32';
    const command = windows ? process.execPath : 'npm';
    const args = windows ? [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'), ...npmArgs] : npmArgs;
    const { stdout } = await exec(command, args, { cwd: tempPackage, env });
    const [entry] = JSON.parse(stdout);
    const bytes = await readFile(path.join(tempPackage, entry.filename));
    await rm(path.join(tempPackage, entry.filename));
    checksums[file] = createHash('sha256').update(bytes).digest('hex');
    await writeFile(path.join(source, file), bytes);
  }
  await pack({ name: 'bb-app', version: '1.1.0', bin: { 'bb-app': 'dist/bb-app.js' } }, 'release/bb-app-custom.tgz');
  for (const name of ['monocode-ui', 'monocode-colors', 'monocode-sidebar', 'monocode-composer', 'monocode-environment-card', 'turn-usage']) {
    const nameInPackage = name === 'monocode-environment-card' ? 'environment-card' : name;
    await pack({ name: `bb-plugin-${nameInPackage}`, version: '1.1.0' }, `release/plugins/${name}.tgz`);
  }
  const palette = '{"light":{},"dark":{"inlineCodeText":"#eab87e"}}';
  const theme = 'theme/monocode-dark-palette.json';
  checksums[theme] = createHash('sha256').update(palette).digest('hex');
  await writeFile(path.join(source, theme), palette);
  for (const name of ['wallpaper-dark-desktop.jpg', 'wallpaper-dark-mobile.jpg']) {
    const file = `theme/${name}`;
    const bytes = await readFile(new URL(file, import.meta.url));
    checksums[file] = createHash('sha256').update(bytes).digest('hex');
    await writeFile(path.join(source, file), bytes);
  }
  await writeJson(path.join(source, 'sha256.json'), checksums);
  return source;
}

test('discovers canonical POSIX directories and ignores unrelated machine folders', async t => {
  const { home, run } = await fixture(t);
  const machine = path.join(home, '.bb-machines', 'demo.getbb.app');
  await mkdir(machine, { recursive: true });
  await mkdir(path.join(home, '.bb-machines', 'archive'));
  assert.deepEqual(await discoverDirectories(home), [machine]);
  await mkdir(path.join(home, '.bb'));
  await assert.rejects(run('--dry-run'), /Several BB directories were found/);
});

test('discovers an enrolled directory and both canonical path layouts with Windows paths', async () => {
  const home = String.raw`C:\Users\Example Name`;
  const machine = path.win32.join(home, '.bb-machines', 'demo.getbb.app');
  const data = path.win32.join(home, '.bb');
  const filesystem = {
    async readdir(folder) {
      assert.equal(folder, path.win32.join(home, '.bb-machines'));
      return [{ name: 'demo.getbb.app', isDirectory: () => true }, { name: 'download.getbb.app', isDirectory: () => false }];
    },
    async exists(folder) { return [machine, data].includes(folder); },
  };
  assert.deepEqual(await discoverDirectories(home, 'win32', filesystem), [machine, data]);
  assert.equal(layoutPaths(data, 'win32').global, data + String.raw`\npm\node_modules\bb-app`);
  assert.equal(layoutPaths('/home/example/.bb', 'linux').global, '/home/example/.bb/npm/lib/node_modules/bb-app');
  assert.equal(layoutPaths('/home/example/.bb', 'darwin').local, '/home/example/.bb/npm/node_modules/bb-app');
  assert.equal(isBbProcess(`"C:\\Program Files\\nodejs\\node.exe" "${layoutPaths(data, 'win32').global}\\dist\\bb-app.js" start`, data, home, 'win32'), true);
});

test('dry-run reports the existing installation without reading the release or creating state', async t => {
  const { root, run } = await fixture(t);
  const dataDir = path.join(root, 'instance');
  await fakeOriginal(dataDir, layoutPaths(dataDir).global);
  const { stdout } = await run('--source', path.join(root, 'absent-release'), '--dir', dataDir, '--dry-run');
  assert.match(stdout, /replace bb-app 1\.0\.0/);
  await assert.rejects(stat(path.join(dataDir, 'bb-share')), { code: 'ENOENT' });
});

test('invokes the CLI from a linked directory', async t => {
  const { root, env } = await fixture(t);
  const linked = path.join(root, 'linked entry');
  await symlink(path.dirname(installer), linked, 'junction');
  const { stdout } = await exec(process.execPath, [path.join(linked, 'install.mjs'), '--help'], { env });
  assert.match(stdout, /node install\.mjs .*--post-start/);
});

test('a live PID owning the BB runtime record blocks core replacement before staging', async t => {
  const { root, run } = await fixture(t);
  const dataDir = path.join(root, 'instance');
  const original = layoutPaths(dataDir).global;
  await fakeOriginal(dataDir, original);
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  t.after(() => child.kill());
  await writeJson(path.join(dataDir, 'bb-app-runtime.json'), { pid: child.pid, serverUrl: 'http://127.0.0.1:1' });
  await assert.rejects(run('--dir', dataDir, '--skip-post-start'), /BB is still running/);
  assert.equal((await manifest(original)).version, '1.0.0');
  await assert.rejects(stat(path.join(dataDir, 'bb-share')), { code: 'ENOENT' });
});

test('offline npm install and rollback honor both supported directory layouts', async t => {
  const { root, env, run } = await fixture(t);
  const source = await fixtureRelease(root, env);
  const kinds = process.platform === 'win32' ? ['global'] : ['global', 'local'];
  const downloaded = path.join(root, 'downloaded installer.mjs');
  for (const kind of kinds) {
    const dataDir = path.join(root, `installed ${kind}`);
    const location = layoutPaths(dataDir)[kind];
    await fakeOriginal(dataDir, location);
    await copyFile(installer, downloaded);
    const runFile = (entry, ...args) => exec(process.execPath, [entry, ...args], { env, timeout: 60_000 });
    const staged = await runFile(downloaded, '--source', source, '--dir', dataDir, '--skip-post-start');
    await rm(downloaded);
    assert.equal((await manifest(location)).version, '1.1.0');
    const backup = path.join(dataDir, 'bb-share', 'original-npm');
    assert.equal(await readFile(path.join(backup, 'original-shim'), 'utf8'), 'original');
    assert.match(await readFile(path.join(dataDir, 'bb-share', 'pending.json'), 'utf8'), /release-/);
    const saved = path.join(dataDir, 'bb-share', 'install.mjs');
    const canonicalSaved = path.join(await realpath(dataDir), 'bb-share', 'install.mjs');
    assert.ok(staged.stdout.includes(`node "${canonicalSaved}" --post-start`));
    assert.ok(staged.stdout.includes(`node "${canonicalSaved}" --rollback`));
    await assert.rejects(runFile(saved, '--post-start', '--wait-seconds', '1'), error =>
      /BB did not become ready/.test(error.stderr) && error.stderr.includes(`node "${canonicalSaved}" --post-start`));
    await runFile(saved, '--rollback');
    assert.equal((await manifest(location)).version, '1.0.0');
    assert.equal(await readFile(path.join(dataDir, 'npm', 'original-shim'), 'utf8'), 'original');
    await assert.rejects(stat(backup), { code: 'ENOENT' });
    await assert.rejects(stat(path.join(dataDir, 'bb-share', 'pending.json')), { code: 'ENOENT' });
  }
  const desktop = path.join(root, 'desktop');
  await mkdir(desktop);
  await rm(path.join(source, 'theme', 'wallpaper-dark-desktop.jpg'));
  await run('--source', source, '--dir', desktop, '--plugins-only', '--skip-post-start', '--no-wallpaper');
  await assert.rejects(stat(path.join(desktop, 'npm')), { code: 'ENOENT' });
  await stat(path.join(desktop, 'bb-share', 'pending.json'));
  await stat(path.join(desktop, 'bb-share', 'install.mjs'));
  const dataDir = path.join(root, 'checksum failure');
  const location = layoutPaths(dataDir).global;
  await fakeOriginal(dataDir, location);
  await writeFile(path.join(source, 'theme', 'monocode-dark-palette.json'), '{}');
  await assert.rejects(run('--source', source, '--dir', dataDir, '--skip-post-start'), /SHA-256 mismatch/);
  assert.equal((await manifest(location)).version, '1.0.0');
});

const installedTestApp = process.env.BB_SHARE_TEST_APP_ROOT;
const release = path.dirname(installer);

async function freeLoopbackPort() {
  const socket = createServer();
  await new Promise((resolve, reject) => socket.listen(0, '127.0.0.1', resolve).once('error', reject));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  return port;
}

test('post-start applies and protects real MonoCode wallpapers', {
  skip: !installedTestApp || process.platform === 'win32',
  timeout: 240_000,
}, async t => {
  const { root, home, env, run } = await fixture(t);
  const dataDir = path.join(root, 'isolated data');
  await mkdir(dataDir);
  const [port, hostPort] = await Promise.all([freeLoopbackPort(), freeLoopbackPort()]);
  const url = `http://127.0.0.1:${port}`;
  const entry = path.join(installedTestApp, 'dist', 'bb-app.js');
  const cli = path.join(installedTestApp, 'dist', 'bb.js');
  const appEnv = { PATH: process.env.PATH, HOME: home, TMPDIR: root, NODE_ENV: 'production', BB_TELEMETRY: 'false' };
  const bb = spawn(process.execPath, [entry, '--data-dir', dataDir, '--server-port', String(port),
    '--host-daemon-port', String(hostPort), '--bundled'], { env: appEnv, detached: true, stdio: 'ignore' });
  const stopped = new Promise(resolve => bb.once('exit', resolve));
  const controller = new AbortController();
  const pending = path.join(dataDir, 'bb-share', 'install.mjs');
  const cliEnv = { ...appEnv, BB_DATA_DIR: dataDir, BB_SERVER_URL: url };
  const bg = async (...args) => (await exec(process.execPath, [cli, 'monocode-colors', 'bg', ...args], {
    env: cliEnv, timeout: 30_000, signal: controller.signal,
  })).stdout;
  const read = async () => JSON.parse(await bg('--json'));
  const prepare = (...flags) => run('--source', release, '--dir', dataDir, '--plugins-only', '--skip-post-start',
    '--server-url', url, '--bb-cli', cli, ...flags);
  const resume = (...flags) => exec(process.execPath, [pending, '--post-start', ...flags], {
    env, timeout: 120_000, signal: controller.signal,
  });
  try {
    await t.test('default setup writes both dark slots and the recommended look', async () => {
      await prepare();
      await resume();
      const { images, look } = await read();
      assert.ok(images.dark);
      assert.ok(images.darkMobile);
      assert.equal(images.light, null);
      assert.equal(images.lightMobile, null);
      assert.deepEqual(look, { fit: 'cover', position: 'center', opacity: 56, blur: 0, scrim: 10 });
    });
    await t.test('existing dark images and shared settings survive when the other slot is filled', async () => {
      for (const slot of ['dark', 'darkMobile']) {
        await bg('clear', '--dark');
        const mobile = slot === 'darkMobile' ? ['--mobile'] : [];
        const otherImage = slot === 'darkMobile' ? 'wallpaper-dark-desktop.jpg' : 'wallpaper-dark-mobile.jpg';
        await bg('set', path.join(release, 'theme', otherImage), '--dark', ...mobile);
        await bg('opacity', '37');
        const before = await read();
        await prepare();
        await resume();
        const after = await read();
        assert.equal(after.images[slot], before.images[slot]);
        assert.ok(after.images[slot === 'dark' ? 'darkMobile' : 'dark']);
        assert.deepEqual(after.look, before.look);
        assert.equal(after.images.light, null);
        assert.equal(after.images.lightMobile, null);
      }
    });
    await t.test('no-wallpaper is honored when staging or resuming', async () => {
      await bg('clear', '--dark');
      const before = await read();
      await prepare('--no-wallpaper');
      await resume();
      assert.deepEqual(await read(), before);
      await prepare();
      await resume('--no-wallpaper');
      assert.deepEqual(await read(), before);
    });
  } finally {
    controller.abort();
    if (bb.exitCode === null && bb.signalCode === null) {
      process.kill(-bb.pid, 'SIGTERM');
      await Promise.race([stopped, delay(5000, undefined, { ref: false })]);
      if (bb.exitCode === null && bb.signalCode === null) await stopped;
    }
  }
});
