import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const [source, input] = process.argv.slice(2).map(value => path.resolve(value));
assert.ok(source && input, "Usage: node scripts/build-desktop.mjs <upstream> <inputs>");
const mac = process.platform === "darwin";
assert.ok(mac ? process.arch === "arm64" : process.platform === "win32" && process.arch === "x64",
  "Build on a native macOS arm64 or Windows x64 runner");

const desktop = path.join(source, "apps", "desktop");
const runtime = path.join(source, "packages", "bb-app");
const json = async file => JSON.parse(await readFile(file, "utf8"));
const sha256 = async file => createHash("sha256").update(await readFile(file)).digest("hex");
const run = (command, args, cwd = desktop) => execFileSync(command, args, { cwd, stdio: "inherit" });
const tarball = path.join(input, "bb-app-custom.tgz");
const manifest = await json(path.join(input, "sha256.json"));
assert.equal(await sha256(tarball), manifest["release/bb-app-custom.tgz"], "Custom core SHA-256 mismatch");

const extracted = path.join(input, "core");
await mkdir(extracted);
run("tar", ["-xzf", "bb-app-custom.tgz", "-C", "core", "--strip-components=1"], input);
const corePackage = await json(path.join(extracted, "package.json"));
const upstreamPackage = await json(path.join(runtime, "package.json"));
assert.equal(corePackage.name, upstreamPackage.name);
assert.equal(corePackage.version, upstreamPackage.version);
assert.deepEqual(corePackage.dependencies, upstreamPackage.dependencies);
for (const folder of ["app", "dist", "host-daemon", "server"]) {
  await cp(path.join(extracted, folder), path.join(runtime, folder), { recursive: true });
}

async function replaceOnce(relative, original, replacement) {
  const file = path.join(desktop, relative);
  const text = (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
  assert.equal(text.split(original).length, 2, `Unexpected upstream source: ${relative}`);
  await writeFile(file, text.replace(original, replacement));
}

await replaceOnce("src/bb-app-bridge.ts", 'import "bb-app/dist/bb-app.js";',
  'process.argv.push("--bundled", "--no-in-app-updates");\nawait import("bb-app/dist/bb-app.js");');
await replaceOnce("src/main.ts", "const desktopUpdateSupport = resolveDesktopUpdateSupport({\n    canReplaceAppImage,\n    env: process.env,\n    platform: desktopPlatform,\n  });",
  "const desktopUpdateSupport = { versionCheck: false, autoUpdate: false };");
await replaceOnce("src/main.ts", "resolveDesktopUpdateSupport({\n            canReplaceAppImage,\n            env: process.env,\n            platform: resolveBbDesktopPlatform(process.platform),\n          }).autoUpdate", "false");
await replaceOnce("src/desktop-update-provider.ts", 'applicationName: "bb" | "bb Nightly";',
  'applicationName: "BB Custom" | "bb Nightly";');
await replaceOnce("src/desktop-update-provider.ts", 'applicationName: nightly ? "bb Nightly" : "bb",',
  'applicationName: nightly ? "bb Nightly" : "BB Custom",');
await replaceOnce("src/desktop-update-provider.ts", 'updateReleaseBaseUrl: `https://github.com/get-bb/bb/releases/download/${releaseTag}/`,',
  'updateReleaseBaseUrl: "https://example.invalid/updates-disabled/",');
await replaceOnce("scripts/desktop-release-channel.mjs", 'applicationName: "bb",',
  'applicationName: "BB Custom",');

run(process.execPath, ["scripts/build.mjs"]);
const config = await json(path.join(desktop, "electron-builder.config.json"));
delete config.publish;
config.productName = "BB Custom";
config.appId = "dev.bb.desktop.custom";
config.extraMetadata = { name: "bb-custom-desktop" };
config.artifactName = mac ? "bb-custom-macos-arm64.dmg" : "bb-custom-windows-x64.exe";
config.mac = { ...config.mac, identity: "-", notarize: false, hardenedRuntime: false, target: ["dmg"] };
config.win = { ...config.win, signAndEditExecutable: false, target: ["nsis"] };
await writeFile(path.join(desktop, "electron-builder.custom.json"), JSON.stringify(config, null, 2));
run(process.execPath, ["node_modules/electron-builder/cli.js", "--config", "electron-builder.custom.json",
  ...(mac ? ["--mac", "--arm64"] : ["--win", "--x64"]), "--publish", "never"]);

const release = path.join(desktop, "release");
const packaged = mac
  ? path.join(release, (await readdir(release)).find(name => name.startsWith("mac")), "BB Custom.app", "Contents", "Resources")
  : path.join(release, "win-unpacked", "resources");
const serverEntry = "server/dist/index.js";
assert.equal(
  await sha256(path.join(packaged, "app.asar.unpacked", "node_modules", "bb-app", serverEntry)),
  await sha256(path.join(extracted, serverEntry)),
  "Packaged server differs from the verified custom core",
);
assert.ok((await readFile(path.join(release, config.artifactName))).length > 0);
run(process.execPath, ["scripts/smoke-packaged-app.mjs"]);
