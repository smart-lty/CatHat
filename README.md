# BB 定制分享版

基于 BB 0.49.0，包含核心 npm 包、六个预构建插件、MonoCode 暗色色板和桌面横版、手机竖版暗色壁纸。核心包包含浏览器 UI、server、host daemon、CLI、SQLite 数据层与内置插件。

- 输入框把权限选项收进模型菜单，支持宽屏居中、统一的 Queue 提示和多轮回报去重。
- 子任务每父线程最多并发三个，按加入顺序排队，Undo 保留相应槽位。回报支持合并通知、人工回合防打断、右窗直聊静默和空回防抖。内置存储保留插件含自动归档护栏。
- MonoCode 提供烟熏黑、暖杏色行内代码、独立的暗色 Markdown、壁纸与移动端背景选项、Projects / Activity 双视图、侧栏滑动归档与 Undo、胶囊输入框、Environment 卡片和每轮用量。

## 方式 1 · 下载桌面安装包

- **macOS Apple Silicon（arm64）** 下载 [DMG](https://github.com/smart-lty/bb-custom/releases/latest/download/bb-custom-macos-arm64.dmg)，打开后将 `BB Custom.app` 拖到 Applications。此版本采用临时签名，未经 Apple 公证。确认下载可信后，如系统阻止启动，可在终端执行 `xattr -cr "/Applications/BB Custom.app"`，再打开应用。
- **Windows x64** 下载 [EXE](https://github.com/smart-lty/bb-custom/releases/latest/download/bb-custom-windows-x64.exe)。确认下载可信后，若 SmartScreen 显示保护提示，点 **更多信息 → 仍要运行**。

桌面包内含 BB 定制核心，关闭了桌面壳与核心的更新入口。首次启动前请退出占用同一本地端口的 BB，并选择本地运行。六个 MonoCode 插件、色板和壁纸通过现有安装器补装。启动 BB Custom 后，用下方脚本的传参方式加 `--plugins-only --dir "<BB 数据目录>"`。需要指定 CLI 时，`--bb-cli` 指向安装目录下 `resources/app.asar.unpacked/node_modules/bb-app/dist/bb.js`。macOS 的对应路径为 `BB Custom.app/Contents/Resources/app.asar.unpacked/node_modules/bb-app/dist/bb.js`。没有启动记录时同时使用 `--server-url` 指定本地实例。仓库为私有时，有权限的用户可下载 Release 文件，按下方本地目录布局执行 `node install.mjs --source . --plugins-only`。

维护者可从 **Actions → Build custom desktop installers** 手动运行 workflow。默认使用 `v0.49.0-custom.1`，两个平台都通过打包冒烟检查后才上传。取消勾选 `upload_to_release` 可仅保留本轮 Actions 产物。

## 方式 2 · 官方签名 BB + 一键脚本

此方式使用官方签名桌面壳或现有的 npm 安装，无需放行新的桌面安装包，支持 `--rollback` 恢复原核心。

需要 Node.js 22.19+、npm 和 Git。BB 0.49.0 的 Node 支持范围为 22.19+ 的 22 系列、24 和 26。原生 Windows 使用 Node.js 与 Git for Windows；WSL2 请在同一 Linux 发行版里安装并运行 Node、Git、BB 和本脚本。

先完全退出要替换的 BB 实例，并停止它的后台服务。安装器会发现家目录下的 `~/.bb` 和 `~/.bb-machines/*.getbb.app`。有多个实例时可交互选择，也可以用 `--dir` 指定。建议以官方 BB 0.49.0 为起点。现有 BB 若由 `npx` 从临时缓存运行，先按下文准备一个固定 npm 安装。

macOS、Linux、WSL2，在发布后将地址换成实际 GitHub Release 下载地址。

```bash
curl -fsSL https://github.com/smart-lty/bb-custom/releases/latest/download/install.sh | bash
```

Windows PowerShell。

```powershell
irm https://github.com/smart-lty/bb-custom/releases/latest/download/install.ps1 | iex
```

需要指定数据目录或传入其他选项时，可用下面的写法。

```bash
curl -fsSL https://github.com/smart-lty/bb-custom/releases/latest/download/install.sh |
  bash -s -- --dir "/path/to/bb-data" --dry-run
```

```powershell
& ([scriptblock]::Create((irm https://github.com/smart-lty/bb-custom/releases/latest/download/install.ps1))) --dir 'C:\Path\To\BB' --dry-run
```

薄壳使用发布时设置的下载地址，也可用 `BB_SHARE_BASE_URL` 或 `$env:BB_SHARE_BASE_URL` 覆盖。命令会执行下载的脚本，请使用你信任的发布地址。

看到提示后，用原来的启动方式重新打开 BB。安装器会等待本地 server 就绪，随后用 BB CLI 安装六个插件并导入暗色色板，保留已有的浅色色板。选择 Settings 里的 **MonoCode** 主题和 **Dark** 模式即可查看效果。空置的暗色桌面与手机竖屏槽位会加入默认壁纸。四个壁纸槽位都为空时，会应用推荐效果（填满视窗、居中、透明度 56、遮罩 10、模糊 0）。已有壁纸时保留原图和现有视觉参数，浅色槽位保持原设置。

使用 `--no-wallpaper` 可以只应用烟熏黑暗色色板、跳过默认壁纸。执行分步安装时，可在准备阶段或 `--post-start` 阶段传入该参数。随时可在 **Settings → MonoCode colors → Background** 更换或清除图片；也可在 CLI 运行 `bb monocode-colors bg clear --dark` 清除两个暗色槽位，附加 `--mobile` 则只清除手机槽位。

安装器会在所选数据目录的 `bb-share/install.mjs` 留下一份副本。默认等待五分钟。按 Ctrl+C 中断或超时后，启动 BB 并运行以下命令。该副本会自动使用所在的 BB 数据目录。

```text
node "<BB 数据目录>/bb-share/install.mjs" --post-start
```

`--skip-post-start` 只做退出态的准备和核心替换。`--plugins-only` 使用现有核心，可在 BB 运行时准备并安装插件。同一发布包的插件针对 SDK 0.6.132 构建。

纯桌面安装的数据目录可能没有 `npm/`。只安装插件时，保持桌面 BB 打开并使用 `--plugins-only --dir <数据目录>`。如果安装器找不到 CLI，请启用桌面版的 `bb` 命令，或用 `--bb-cli <官方 bb.js 路径>` 指定 JavaScript 入口。要运行定制核心，可按下方命令在所选数据目录准备官方 npm 包，再安装并从该目录的 `npm/` 启动。

自动等待读取所选数据目录的 BB 启动记录。由桌面或后台服务以不同方式启动、且没有记录时，用 `--server-url http://127.0.0.1:38886` 指向**该实例**的本地地址。若选中的目录只运行远端 BB 的 host daemon，需在提供应用与插件 API 的 server 所在机器执行，或运行本地完整 BB。

## 本地测试与分步安装

把发布目录完整复制到本机，保留 `release/`、`theme/` 和根目录的 `sha256.json`。`--source .` 从本地取发布文件。首次安装核心时，npm 仍可能从 registry 下载依赖和目标系统的原生模块。

已有固定 npm 安装时，从发布目录执行。

```bash
node install.mjs --source . --dir "/path/to/bb-data" --dry-run
node install.mjs --source . --dir "/path/to/bb-data" --skip-post-start
# 重新启动该 BB 后
node "/path/to/bb-data/bb-share/install.mjs" --post-start
```

全新安装，或原来只用 `npx` 时，可以先在一个新目录准备官方版本，再替换核心。macOS、Linux、WSL2 示例使用默认端口。已有 BB 运行时避免使用相同端口，并先退出要替换的实例。

```bash
bb_data="$HOME/.bb-share-sandbox"
mkdir -p "$bb_data"
npm install --global --prefix "$bb_data/npm" --no-audit --no-fund \
  --allow-scripts=better-sqlite3,node-pty,@parcel/watcher bb-app@0.49.0
node install.mjs --source . --dir "$bb_data" --skip-post-start
node "$bb_data/npm/lib/node_modules/bb-app/dist/bb-app.js" --data-dir "$bb_data" --bundled
# 另一终端，设置相同的 bb_data 后执行
node "$bb_data/bb-share/install.mjs" --post-start
```

Windows PowerShell 对应命令。

```powershell
$bbData = Join-Path $HOME '.bb-share-sandbox'
New-Item -ItemType Directory -Force $bbData | Out-Null
npm.cmd install --global --prefix (Join-Path $bbData 'npm') --no-audit --no-fund '--allow-scripts=better-sqlite3,node-pty,@parcel/watcher' 'bb-app@0.49.0'
node .\install.mjs --source . --dir $bbData --skip-post-start
node (Join-Path $bbData 'npm\node_modules\bb-app\dist\bb-app.js') --data-dir $bbData --bundled
# 另一终端，设置相同的 $bbData 后执行
node (Join-Path $bbData 'bb-share/install.mjs') --post-start
```

需要启用 7 天自动归档时，可先预览再保存。已有存储保留策略时用 `bb storage retention` 查看。

```text
bb plugin enable bb--storage-retention
bb storage retention --archive-after 7
bb storage retention --archive-after 7 --save --yes
```

## 回滚官方核心

完全退出该 BB，停止它的后台服务，然后执行。

```text
node "<BB 数据目录>/bb-share/install.mjs" --rollback
```

安装前的整个 npm 目录会从 `<BB 数据目录>/bb-share/original-npm` 移回原处，包含原来的可执行入口和原生依赖。回滚针对程序包，数据库、对话、插件注册、色板和壁纸由 BB 自身管理。需要关闭分享版插件时，在 BB 重新启动后从 Settings → Plugins 禁用，或执行 `bb plugin disable <id>`。六个 ID 为 `monocode-ui`、`monocode-colors`、`monocode-sidebar`、`monocode-composer`、`environment-card` 和 `turn-usage`。

## GitHub 发布

1. 复核 [脱敏扫描](PRIVACY.md) 和 [隔离验证](VERIFICATION.md)。在新仓库中加入此目录的文件，保留许可证。两个薄壳与使用示例均指向 `smart-lty/bb-custom`。
2. 在该分享仓库提交并推送，创建一个 GitHub Release，例如 `v0.49.0-custom.1`。
3. 把 `install.sh`、`install.ps1`、`install.mjs`、`sha256.json`、核心 tgz、六个插件 tgz、色板 JSON 和两张壁纸 JPG 作为同一个 Release 的独立附件上传。GitHub Release 附件按文件名平铺。用该发布的下载地址验证两条一键命令，再分享链接。
