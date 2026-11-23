# 隔离验证

| 项目 | 结果 |
| --- | --- |
| 构建 | 在独立临时源码副本中运行 Turbo，核心和六个插件首轮构建 68 个任务通过。脱敏后重建侧栏，并用 `npm pack` 打包最终产物。 |
| 安装器测试 | macOS arm64 上，Node 22.23.5 和 26.13.0 各 6 项通过。覆盖目录发现、模拟 Windows 路径、只读预演、软链入口、运行中拦截、本地包安装、POSIX 两种 npm 目录布局、持久副本续跑与回滚、无 npm 目录时的仅插件准备和校验和错误拦截。 |
| 核心回归 | 在脱敏构建副本中，子任务并发、队列、通知等服务端测试 81 项通过，SQLite 查询计划测试 52 项通过。 |
| Shell | `bash -n install.sh` 和本地薄壳 `--help` 通过。Bash 管道以有 PTY、无控制终端的方式启动，经过软链临时目录成功执行预演。PowerShell 7.5.4 官方 macOS arm64 版 AST 解析器检查 `install.ps1` 与 README 中三段 PowerShell 示例，无语法错误。用本地下载夹具验证了文件直跑和 ScriptBlock 传参，以及 IEX 调用后的作用域和进程设置。 |
| npm 实装 | macOS arm64，Node 26.13.0，npm 11.20.0。先安装公开的官方 BB 0.49.0，再从本目录安装定制 tgz。分别加载了 SQLite 3.53.4、`@parcel/watcher` 和 `node-pty` 原生模块。 |
| 启动与 CLI | 隔离的 HOME、临时数据目录和未占用的 loopback 端口。应用 HTML、server health、host daemon 连接、`bb status`、`bb project list --json` 均通过。 |
| 两阶段安装 | 同一条安装命令等待本地 BB 启动，六个插件全部显示 `running`。导出的暗色色板与发布 JSON 一致，浅色色板为初始值。也验证了 `--plugins-only --skip-post-start`、等待超时或 Ctrl+C 后保留现场，以及重新启动后使用 `--post-start` 续跑。本轮另用真实 BB 包在无 npm 目录的隔离数据目录验证了持久副本。临时下载副本删除后，持久副本自动读取保存的 CLI 和本地 server 地址，装好六个插件并导入色板。 |
| 内置插件 | `concurrency-limit`、`side-chat` 已运行；通过 CLI 启用了默认关闭的 `storage-retention`，预览并设置了 7 天自动归档。 |
| 回滚 | 隔离服务运行时拦截了回滚；退出后真实恢复官方 npm 目录，启动器 SHA-256 与替换前一致。 |

本轮修订仅涉及安装脚本、测试、使用说明与验证记录。复扫这六个文件后，私人和公司内网关键词命中为 0。七个 tgz 的修改前后 SHA-256 全部一致。

Linux、WSL2 和 Windows 原生的完整启动仍待实机验证。Windows 本次验证覆盖路径和进程命令样例，以及 PowerShell 脚本语法。发布附件的布局与下载逻辑已按 GitHub Release 设计，远端发布与下载尚未执行。UI 验证到 HTML 响应，侧栏、输入框和壁纸的视觉效果留给审阅。

复跑安装器测试。

```bash
node --test install.test.mjs
bash -n install.sh
```
