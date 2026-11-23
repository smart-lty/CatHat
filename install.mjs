import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, realpathSync } from 'node:fs';
import { access, copyFile, cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';

const exec = promisify(execFile);
const entryPath = fileURLToPath(import.meta.url);

function comparablePath(filename) {
  let resolved;
  try {
    resolved = realpathSync.native(filename);
  } catch {
    resolved = path.resolve(filename);
  }
  return process.platform === 'win32' ? path.win32.normalize(resolved).toLowerCase() : resolved;
}

async function renameWithRetry(from, to) {
  const retries = process.platform === 'win32' ? 5 : 0;
  for (let attempt = 0; ; attempt++) {
    try {
      return await rename(from, to);
    } catch (error) {
      if (attempt >= retries || !['EPERM', 'EACCES', 'EBUSY'].includes(error.code)) throw error;
      await delay(50 * 2 ** attempt);
    }
  }
}

function recoveryCommand(stateDir, mode) {
  return `node "${path.join(stateDir, 'install.mjs')}" --${mode}`;
}

async function retainInstaller(stateDir) {
  const target = path.join(stateDir, 'install.mjs');
  if (comparablePath(entryPath) === comparablePath(target)) return;
  const work = await mkdtemp(path.join(stateDir, 'installer-copy-'));
  try {
    const copy = path.join(work, 'install.mjs');
    await copyFile(entryPath, copy);
    await renameWithRetry(copy, target);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
const core = 'release/bb-app-custom.tgz';
const palette = 'theme/monocode-dark-palette.json';
const wallpapers = {
  dark: 'theme/wallpaper-dark-desktop.jpg',
  darkMobile: 'theme/wallpaper-dark-mobile.jpg',
};
const plugins = ['monocode-ui', 'monocode-colors', 'monocode-sidebar', 'monocode-composer', 'monocode-environment-card', 'turn-usage', 'cathat-memory'];
const archives = plugins.map(id => `release/plugins/${id}.tgz`);
const starterArchive = 'release/cathat-starter.tgz';
const starterPackage = 'bb-cathat-starter';
const starterFiles = ['AGENTS.md', '.agents/skills/cathat-dispatch/SKILL.md', 'SOUL.md.example',
  'memory/global/MEMORY.md', 'memory/projects/cathat/MEMORY.md'];
const pluginId = name => name === 'monocode-environment-card' ? 'environment-card' : name;
const pluginPackage = name => `bb-plugin-${pluginId(name)}`;
const allowedNativeScripts = 'better-sqlite3,node-pty,@parcel/watcher';
const json = async file => JSON.parse(await readFile(file, 'utf8'));
async function exists(file) {
  try {
    await access(file);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export function layoutPaths(dataDir, platform = process.platform) {
  const route = platform === 'win32' ? path.win32 : path.posix;
  const prefix = route.join(dataDir, 'npm');
  return {
    prefix,
    global: route.join(prefix, ...(platform === 'win32' ? [] : ['lib']), 'node_modules', 'bb-app'),
    local: route.join(prefix, 'node_modules', 'bb-app'),
  };
}

export async function discoverDirectories(home = homedir(), platform = process.platform, fs = { readdir, exists }) {
  const route = platform === 'win32' ? path.win32 : path.posix;
  const machines = route.join(home, '.bb-machines');
  const entries = await fs.readdir(machines, { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const candidates = [
    ...entries.filter(entry => entry.name.endsWith('.getbb.app') && entry.isDirectory()).map(entry => route.join(machines, entry.name)).sort(),
    route.join(home, '.bb'),
  ];
  const found = await Promise.all(candidates.map(async dir => await fs.exists(dir) ? dir : null));
  return found.filter(Boolean);
}

async function selectDirectory(explicit) {
  if (explicit) return realpath(path.resolve(explicit));
  const candidates = await discoverDirectories();
  if (candidates.length === 1) return realpath(candidates[0]);
  if (candidates.length === 0) throw new Error('No BB data directory found. Start official BB once, or pass --dir.');
  const list = candidates.map((dir, index) => `${index + 1}. ${dir}`).join('\n');
  if (!process.stdin.isTTY) throw new Error(`Several BB directories were found. Pass --dir.\n${list}`);
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question(`${list}\nChoose a BB directory: `);
    const selected = candidates[Number(answer) - 1];
    if (!selected) throw new Error('Select a listed directory, or pass --dir.');
    return realpath(selected);
  } finally {
    prompt.close();
  }
}

export function isBbProcess(command, dataDir, home = homedir(), platform = process.platform) {
  const normalize = value => {
    const portable = value.replaceAll('\\', '/');
    return platform === 'win32' || platform === 'darwin' ? portable.toLowerCase() : portable;
  };
  const line = normalize(command.trim());
  const target = normalize(dataDir);
  const userHome = normalize(home);
  const standard = target === `${userHome}/.bb` || target.startsWith(`${userHome}/.bb-machines/`);
  const launcher = /(?:^|[/\s"'])bb-(?:app|server|host-daemon)(?:\.js|\.exe)?(?=[\s"']|$)|(?:^|[/\s"'])daemon-bundle\.mjs(?=[\s"']|$)|\/node_modules\/bb-app\/server\/dist\/index\.js(?=[\s"']|$)/i.test(line);
  const desktop = /(?:^|\/)(?:bb\.app\/contents\/macos\/bb|bb\.exe)(?=[\s"']|$)/i.test(line);
  const otherApplication = /^(?:[^\s]*\/)?(?:bash|zsh|sh|fish|pwsh|powershell|curl|rg|grep)(?:\.exe)?\s/i.test(line);
  if (otherApplication) return false;
  if (launcher && line.includes(`${target}/`)) return true;
  if (launcher && [`--data-dir ${target}`, `--data-dir "${target}"`, `--data-dir=${target}`, `--data-dir '${target}'`]
      .some(flag => line.endsWith(flag) || line.includes(`${flag} `))) return true;
  if (!standard) return false;
  if (desktop) return true;
  if (!launcher) return false;
  return !line.includes('/.bb-machines/') && !line.includes('/.bb/npm/');
}

function alive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === 'EPERM') return true;
    if (error.code === 'ESRCH') return false;
    throw error;
  }
}

async function runtimeRecord(dataDir) {
  try {
    return await json(path.join(dataDir, 'bb-app-runtime.json'));
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return null;
    throw error;
  }
}

async function requireStopped(dataDir) {
  const runtime = await runtimeRecord(dataDir);
  if (runtime && alive(runtime.pid)) throw new Error('BB is still running. Fully quit BB before changing the core.');
  const windows = process.platform === 'win32';
  const powershell = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const { stdout } = windows
    ? await exec(powershell, ['-NoProfile', '-NonInteractive', '-Command', '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); Get-CimInstance Win32_Process | ForEach-Object { if ($_.CommandLine) { $_.CommandLine } else { $_.Name } }'], { maxBuffer: 16 * 1024 * 1024, timeout: 15_000 })
    : await exec('ps', ['-axww', '-o', 'command='], { maxBuffer: 16 * 1024 * 1024, timeout: 15_000 });
  if (stdout.split(/\r?\n/).some(command => isBbProcess(command, dataDir))) {
    throw new Error('A BB process is still running. Fully quit BB and stop any BB background service before changing the core.');
  }
}

function childEnvironment(dataDir, serverUrl) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^BB_/i.test(key)) delete env[key];
  }
  if (dataDir) env.BB_DATA_DIR = dataDir;
  if (serverUrl) env.BB_SERVER_URL = serverUrl;
  return env;
}

async function npm(args, cwd) {
  const env = childEnvironment();
  const nodeDir = path.dirname(process.execPath);
  const pathKey = Object.keys(env).sort().find(key => process.platform === 'win32' ? /^path$/i.test(key) : key === 'PATH') ?? 'PATH';
  env[pathKey] = [nodeDir, env[pathKey]].filter(Boolean).join(path.delimiter);
  let command = 'npm';
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    const roots = [
      nodeDir,
      path.join(nodeDir, '..', 'lib'),
      ...(appData ? [path.join(appData, 'npm')] : []),
      ...env[pathKey].split(path.delimiter).filter(Boolean),
    ];
    let npmCli;
    for (const root of new Set(roots)) {
      const candidate = path.join(root.replace(/^"(.*)"$/, '$1'), 'node_modules', 'npm', 'bin', 'npm-cli.js');
      if (await exists(candidate)) {
        npmCli = candidate;
        break;
      }
    }
    if (!npmCli) throw new Error('npm was not found. Install Node.js with npm and add it to PATH.');
    command = process.execPath;
    args = [npmCli, ...args];
  }
  const { stdout, stderr } = await exec(command, args, {
    cwd, env, windowsHide: true, maxBuffer: 16 * 1024 * 1024, timeout: 900_000,
  });
  if (stdout.trim()) console.log(stdout.trim());
  if (stderr.trim()) console.error(stderr.trim());
}

async function resolveCli(installed, dataDir, explicitCli) {
  if (explicitCli) {
    const entry = await realpath(path.resolve(explicitCli));
    if (!/\.[cm]?js$/i.test(entry)) throw new Error('--bb-cli must point to the official BB JavaScript CLI entry (bb.js).');
    return [process.execPath, [entry]];
  }
  if (installed) return [process.execPath, [path.join(installed.location, 'dist', 'bb.js')]];
  const runtime = await runtimeRecord(dataDir);
  if (typeof runtime?.entryPath === 'string') {
    const entry = path.join(path.dirname(runtime.entryPath), 'bb.js');
    if (await exists(entry)) return [process.execPath, [entry]];
  }
  return [process.platform === 'win32' ? 'bb.exe' : 'bb', []];
}

async function cli([command, prefixArgs], dataDir, serverUrl, args) {
  const { stdout } = await exec(command, [...prefixArgs, ...args], {
    env: childEnvironment(dataDir, serverUrl), windowsHide: true, maxBuffer: 16 * 1024 * 1024, timeout: 600_000,
  }).catch(error => {
    if (error.code === 'ENOENT') throw new Error('BB CLI not found. Enable the desktop CLI or pass --bb-cli with the official bb.js path.');
    throw error;
  });
  return stdout;
}

function assetReader(source) {
  if (!/^https?:\/\//i.test(source)) {
    return {
      load: name => createReadStream(path.resolve(source, name)),
    };
  }
  const base = new URL(source);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
    throw new Error('Remote --source must be an HTTPS GitHub Release asset base or equivalent HTTPS directory.');
  }
  if (base.hostname === 'github.com') {
    base.pathname = base.pathname.replace(/^(\/[^/]+\/[^/]+\/releases)\/tag\/([^/]+)\/?$/, '$1/download/$2');
    base.pathname = base.pathname.replace(/^(\/[^/]+\/[^/]+\/releases\/latest)\/?$/, '$1/download');
  }
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  return {
    async load(name) {
      const response = await fetch(new URL(path.posix.basename(name), base), { signal: AbortSignal.timeout(300_000) });
      if (!response.ok || !response.body || !response.url.startsWith('https:')) {
        throw new Error(`Download failed for ${name} (HTTP ${response.status}).`);
      }
      return Readable.fromWeb(response.body);
    },
  };
}

async function download(source, name, target) {
  await pipeline(await source.load(name), createWriteStream(target, { flags: 'wx' }));
}

async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function stageRelease(root, sourceName, includeCore, includeWallpaper) {
  const source = assetReader(sourceName);
  const stage = await mkdtemp(path.join(root, 'release-'));
  try {
    const manifest = path.join(stage, 'sha256.json');
    await download(source, 'sha256.json', manifest);
    const checksums = await json(manifest);
    const names = [
      ...archives,
      starterArchive,
      palette,
      ...(includeCore ? [core] : []),
      ...(includeWallpaper ? Object.values(wallpapers) : []),
    ];
    for (const name of names) {
      const expected = checksums[name];
      if (!/^[0-9a-f]{64}$/.test(expected)) throw new Error(`Missing SHA-256 for ${name}.`);
      const target = path.join(stage, path.posix.basename(name));
      await download(source, name, target);
      if (await sha256(target) !== expected) throw new Error(`SHA-256 mismatch for ${name}.`);
    }
    const pluginPrefix = path.join(stage, 'plugins');
    await mkdir(pluginPrefix);
    await npm(['install', '--offline', '--ignore-scripts', '--no-save', '--no-package-lock', '--no-audit', '--no-fund', '--prefix', pluginPrefix, ...[...archives, starterArchive].map(file => path.join(stage, path.posix.basename(file)))], stage);
    for (const id of plugins) {
      const manifest = await json(path.join(pluginPrefix, 'node_modules', pluginPackage(id), 'package.json'));
      if (manifest.name !== pluginPackage(id)) throw new Error(`Invalid plugin package for ${id}.`);
    }
    return stage;
  } catch (error) {
    await rm(stage, { recursive: true, force: true });
    throw error;
  }
}

async function findPackage(dataDir, required = true) {
  const locations = layoutPaths(dataDir);
  for (const [kind, location] of Object.entries({ global: locations.global, local: locations.local })) {
    if (await exists(path.join(location, 'package.json'))) {
      const manifest = await json(path.join(location, 'package.json'));
      if (manifest.name !== 'bb-app') throw new Error(`Unexpected package at ${location}.`);
      return { prefix: locations.prefix, location, kind, version: manifest.version };
    }
  }
  if (!required) return null;
  throw new Error(`No installed bb-app in ${locations.prefix}. Install the official npm-based BB first or use --plugins-only.`);
}

async function replaceCore(dataDir, stateDir, installed, stage) {
  const backup = path.join(stateDir, 'original-npm');
  if (await exists(backup)) throw new Error('A core backup already exists. Roll back before replacing the core again.');
  const work = await mkdtemp(path.join(stateDir, 'npm-stage-'));
  try {
    const prefix = path.join(work, 'npm');
    await cp(installed.prefix, prefix, { recursive: true, verbatimSymlinks: true });
    const global = installed.kind === 'global' || process.platform === 'win32';
    const tarball = path.join(stage, path.posix.basename(core));
    const installFlags = global ? ['--global', `--allow-scripts=${allowedNativeScripts}`] : ['--no-save', '--no-package-lock'];
    const prefixManifest = path.join(prefix, 'package.json');
    let originalManifest;
    if (!global) {
      if (await exists(prefixManifest)) originalManifest = await readFile(prefixManifest, 'utf8');
      const settings = originalManifest ? JSON.parse(originalManifest) : {};
      const allowScripts = Object.fromEntries(allowedNativeScripts.split(',').map(name => [name, true]));
      await writeFile(prefixManifest, JSON.stringify({ ...settings, allowScripts: { ...settings.allowScripts, ...allowScripts } }));
    }
    await npm(['install', ...installFlags, '--prefix', prefix, '--ignore-scripts=false', '--no-audit', '--no-fund', tarball], work);
    if (!global) {
      if (originalManifest === undefined) await rm(prefixManifest);
      else await writeFile(prefixManifest, originalManifest);
    }
    const built = await findPackage(work);
    await exec(process.execPath, [path.join(built.location, 'dist', 'bb-app.js'), '--help'], { cwd: work, env: childEnvironment(dataDir), timeout: 30_000 });
    await requireStopped(dataDir);
    await renameWithRetry(installed.prefix, backup);
    try {
      await renameWithRetry(prefix, installed.prefix);
    } catch (error) {
      await renameWithRetry(backup, installed.prefix);
      throw error;
    }
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

async function rollback(dataDir, stateDir) {
  const { prefix } = layoutPaths(dataDir);
  const backup = path.join(stateDir, 'original-npm');
  if (!await exists(backup)) throw new Error('No original core backup is available.');
  await requireStopped(dataDir);
  const work = await mkdtemp(path.join(stateDir, 'rollback-'));
  const replaced = path.join(work, 'replaced');
  let preserved = false;
  try {
    if (await exists(prefix)) await renameWithRetry(prefix, replaced);
    try {
      await renameWithRetry(backup, prefix);
    } catch (error) {
      if (await exists(replaced)) {
        preserved = true;
        await renameWithRetry(replaced, prefix);
        preserved = false;
      }
      throw error;
    }
    await rm(path.join(stateDir, 'pending.json'), { force: true });
  } finally {
    if (!preserved) await rm(work, { recursive: true, force: true });
  }
  console.log('Original npm installation restored. Plugin registrations and settings are managed in BB.');
}

async function waitForBB(dataDir, explicitUrl, seconds, signal) {
  const deadline = Date.now() + seconds * 1000;
  const url = explicitUrl ? loopbackUrl(explicitUrl) : null;
  do {
    signal.throwIfAborted();
    const runtime = await runtimeRecord(dataDir);
    const target = url ?? (runtime && alive(runtime.pid) ? loopbackUrl(runtime.serverUrl) : null);
    if (target) {
      try {
        const response = await fetch(`${target}/health`, { redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(1500)]) });
        if (response.ok && (await response.json()).ok === true) return target;
      } catch {
        signal.throwIfAborted();
      }
    }
    await delay(1000, undefined, { signal }).catch(error => {
      signal.throwIfAborted();
      throw error;
    });
  } while (Date.now() < deadline);
  throw new Error('BB did not become ready before the timeout.');
}

function loopbackUrl(input) {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('The post-start phase requires a local BB server URL. Use --server-url with a loopback origin.');
  }
  return url.origin;
}

async function applyDefaultWallpaper(run, stage, signal) {
  const background = (...args) => {
    signal.throwIfAborted();
    return run(['monocode-colors', 'bg', ...args]);
  };
  const slots = ['light', 'lightMobile', 'dark', 'darkMobile'];
  const readImages = async () => {
    const { images } = JSON.parse(await background('--json'));
    if (!images || slots.some(slot => images[slot] !== null && typeof images[slot] !== 'string')) {
      throw new Error('Unexpected MonoCode background state. Existing wallpapers were left as-is.');
    }
    return images;
  };
  const images = await readImages();
  if (slots.every(slot => images[slot] === null)) {
    const look = { fit: 'cover', position: 'center', opacity: '56', scrim: '10', blur: '0' };
    for (const [key, value] of Object.entries(look)) await background(key, value);
  }
  for (const [slot, file] of Object.entries(wallpapers)) {
    if (images[slot] !== null || (await readImages())[slot] !== null) continue;
    const mobile = slot === 'darkMobile' ? ['--mobile'] : [];
    await background('set', path.join(stage, path.posix.basename(file)), '--dark', ...mobile);
  }
}

async function initializeCathat(run, stage, directory) {
  const template = path.join(stage, 'plugins', 'node_modules', starterPackage);
  await mkdir(directory, { recursive: true });
  if (!(await lstat(directory)).isDirectory()) throw new Error('CatHat workspace must be a directory, not a link.');
  for (const file of starterFiles) {
    let parent = directory;
    for (const part of path.posix.dirname(file).split('/')) {
      if (part === '.') continue;
      parent = path.join(parent, part);
      await mkdir(parent).catch(error => { if (error.code !== 'EEXIST') throw error; });
      if (!(await lstat(parent)).isDirectory()) throw new Error(`CatHat workspace contains a linked or non-directory path: ${parent}`);
    }
    const source = await readFile(path.join(template, file));
    await writeFile(path.join(directory, file), source, { flag: 'wx' }).catch(error => {
      if (error.code !== 'EEXIST') throw error;
    });
  }
  const workspace = await realpath(directory);
  await run(['plugin', 'config', 'cathat-memory', 'set', 'memoryRoot', path.join(workspace, 'memory')]);
  console.log(`CatHat workspace: ${directory}`);
}

async function postStart(dataDir, stateDir, installed, options, signal) {
  const pendingFile = path.join(stateDir, 'pending.json');
  if (!await exists(pendingFile)) throw new Error('No prepared release awaits plugin setup. Run the installer first.');
  const pending = await json(pendingFile);
  if (!/^release-[a-zA-Z0-9]+$/.test(pending.release)) throw new Error('Invalid pending release record.');
  const stage = path.join(stateDir, pending.release);
  console.log('Open or start BB now. The installer will wait for its local server, then install the plugins and apply the dark palette.');
  const url = await waitForBB(dataDir, options['server-url'] ?? pending.serverUrl, Number(options['wait-seconds']), signal);
  const target = await resolveCli(installed, dataDir, options['bb-cli'] ?? pending.bbCli);
  const run = args => cli(target, dataDir, url, args);
  const pluginList = async () => JSON.parse(await run(['plugin', 'list', '--json'])).plugins;
  for (const name of plugins) {
    const id = pluginId(name);
    signal.throwIfAborted();
    const pluginDir = path.join(stage, 'plugins', 'node_modules', pluginPackage(name));
    const list = await pluginList();
    const current = list.find(plugin => plugin.id === id);
    const replaceMemory = id === 'cathat-memory' && list.some(plugin => plugin.id === 'memory' && plugin.enabled);
    if (replaceMemory) await run(['plugin', 'disable', 'memory']);
    try {
      if (current?.source !== `path:${pluginDir}`) {
        console.log((await run(['plugin', 'install', `path:${pluginDir}`, '--yes'])).trim());
      }
      if (!(await pluginList()).find(plugin => plugin.id === id)?.enabled) await run(['plugin', 'enable', id]);
      const active = (await pluginList()).find(plugin => plugin.id === id);
      if (active?.status !== 'running') throw new Error(`Plugin ${id} is not running. Inspect bb plugin list, then rerun --post-start.`);
    } catch (error) {
      if (replaceMemory) {
        const failed = (await pluginList()).find(plugin => plugin.id === id);
        if (failed?.enabled) await run(['plugin', 'disable', id]);
        await run(['plugin', 'enable', 'memory']);
      }
      throw error;
    }
  }
  const preset = await json(path.join(stage, path.posix.basename(palette)));
  const current = JSON.parse(await run(['monocode-colors', 'export']));
  await run(['monocode-colors', 'import', JSON.stringify({ light: current.light, dark: preset.dark })]);
  if (!options['no-wallpaper'] && pending.wallpaper === true) await applyDefaultWallpaper(run, stage, signal);
  const workspace = options['init-cathat'] ?? pending.cathatWorkspace;
  if (workspace) await initializeCathat(run, stage, workspace);
  else console.log('To create a CatHat workspace, run the release installer with --init-cathat [directory].');
  await rm(pendingFile);
  console.log('Seven plugins are running and the dark palette is applied.');
}

async function main() {
  const args = process.argv.slice(2);
  const initIndex = args.indexOf('--init-cathat');
  if (initIndex !== -1 && (args[initIndex + 1] === undefined || args[initIndex + 1].startsWith('-'))) {
    args.splice(initIndex + 1, 0, path.join(homedir(), 'cathat-workspace'));
  }
  const { values: options } = parseArgs({ args, options: {
    'init-cathat': { type: 'string' },
    source: { type: 'string' }, dir: { type: 'string' }, 'dry-run': { type: 'boolean' },
    rollback: { type: 'boolean' }, 'plugins-only': { type: 'boolean' }, 'skip-post-start': { type: 'boolean' },
    'post-start': { type: 'boolean' }, 'no-wallpaper': { type: 'boolean' }, 'server-url': { type: 'string' }, 'bb-cli': { type: 'string' },
    'wait-seconds': { type: 'string', default: '300' }, help: { type: 'boolean', short: 'h' },
  } });
  if (options.help) {
    console.log('node install.mjs [--source <https-url-or-directory>] [--dir <data-directory>] [--dry-run] [--plugins-only] [--init-cathat [directory]] [--no-wallpaper] [--skip-post-start | --post-start | --rollback] [--wait-seconds <seconds>] [--server-url <local-origin>] [--bb-cli <bb.js>]');
    return;
  }
  const node = process.versions.node.split('.').map(Number);
  if (node[0] < 22 || (node[0] === 22 && node[1] < 19)) throw new Error('Node.js 22.19 or newer is required.');
  if ((options.rollback && (options['init-cathat'] || options['post-start'] || options['plugins-only'] || options['skip-post-start'])) ||
      (options['post-start'] && (options['plugins-only'] || options['skip-post-start']))) throw new Error('Conflicting installer modes.');
  const seconds = Number(options['wait-seconds']);
  if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > 3600) throw new Error('--wait-seconds must be between 1 and 3600.');
  if (options['server-url']) loopbackUrl(options['server-url']);
  if (options['init-cathat'] !== undefined) {
    if (!options['init-cathat']) throw new Error('--init-cathat requires a non-empty directory.');
    options['init-cathat'] = path.resolve(options['init-cathat']);
  }
  const stateEntryDir = path.dirname(entryPath);
  const recovery = options.rollback || options['post-start'];
  const storedDataDir = recovery && path.basename(stateEntryDir) === 'bb-share' ? path.dirname(stateEntryDir) : undefined;
  const dataDir = await selectDirectory(options.dir ?? storedDataDir);
  if (!(await stat(dataDir)).isDirectory()) throw new Error('--dir must be a directory.');
  const state = path.join(dataDir, 'bb-share');
  const needsStopped = options.rollback || (!options['post-start'] && !options['plugins-only'] && !options['init-cathat']);
  const installed = options.rollback ? null : await findPackage(dataDir, needsStopped);
  if (options['dry-run']) {
    if (needsStopped && !options.rollback && await exists(path.join(state, 'original-npm'))) {
      throw new Error('A core backup already exists. Roll back before replacing the core again.');
    }
    console.log(`Dry run | ${dataDir} | ${options.rollback ? 'restore the original npm prefix' : options['post-start'] ? 'resume plugin and palette setup' : (options['plugins-only'] || options['init-cathat']) ? 'stage plugins and palette' : `replace bb-app ${installed.version} at ${installed.location}, keeping the original npm prefix`}`);
    return;
  }
  if (needsStopped) await requireStopped(dataDir);
  await mkdir(state, { recursive: true });
  const lock = path.join(state, 'installer.lock');
  await writeFile(lock, `${process.pid}\n`, { flag: 'wx' }).catch(error => {
    if (error.code === 'EEXIST') throw new Error('Another installation may be active. Check bb-share/installer.lock for its PID.');
    throw error;
  });
  const abort = new AbortController();
  const interrupt = () => abort.abort(new Error('Interrupted.'));
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  try {
    if (options.rollback) {
      await rollback(dataDir, state);
      return;
    }
    if (options['post-start']) {
      await postStart(dataDir, state, installed, options, abort.signal);
      return;
    }
    if (needsStopped && await exists(path.join(state, 'original-npm'))) {
      throw new Error('A core backup already exists. Roll back before replacing the core again.');
    }
    await retainInstaller(state);
    const source = options.source ?? process.env.BB_SHARE_BASE_URL ?? path.dirname(entryPath);
    const wallpaper = !options['no-wallpaper'];
    const stage = await stageRelease(state, source, needsStopped, wallpaper);
    if (needsStopped) {
      await replaceCore(dataDir, state, installed, stage);
      console.log(`Custom core installed. Restore the original npm prefix with: ${recoveryCommand(state, 'rollback')}`);
    }
    const pending = path.join(state, 'pending.json');
    const next = path.join(stage, 'pending.json');
    await writeFile(next, JSON.stringify({
      release: path.basename(stage),
      wallpaper,
      cathatWorkspace: options['init-cathat'],
      serverUrl: options['server-url'],
      bbCli: options['bb-cli'] ? path.resolve(options['bb-cli']) : undefined,
    }));
    await renameWithRetry(next, pending);
    if (options['skip-post-start']) {
      console.log(`Plugins and palette prepared. Start BB, then run: ${recoveryCommand(state, 'post-start')}`);
      return;
    }
    await postStart(dataDir, state, await findPackage(dataDir, needsStopped), options, abort.signal);
  } catch (error) {
    if (!options.rollback && await exists(path.join(state, 'pending.json'))) {
      throw new Error(`${error.message}\nStart BB and continue with: ${recoveryCommand(state, 'post-start')}`, { cause: error });
    }
    throw error;
  } finally {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
    await rm(lock, { force: true });
  }
}

if (process.argv[1] && comparablePath(process.argv[1]) === comparablePath(entryPath)) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
