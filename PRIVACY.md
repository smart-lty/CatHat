# 发布包脱敏扫描

**私人或公司内网信息命中 0。** 公开产品名称、通用示例和功能代码共三类匹配，逐文件列在下方。

原有扫描覆盖发布根目录中的 7 个 npm 压缩包、其全部成员、脚本、测试、色板、许可证、说明和本报告，共 2543 个文件条目。逐一解码了 918 个 Web 预压缩资产。检查文件名和内容，并检查二进制中可识别的 UTF-16LE 字符。统计按出现次数计，预压缩副本单独计。检查了 tgz 成员路径及类型，并核对了全部发布资产的 SHA-256。

构建输入使用临时源码副本中的生产入口与打包白名单。私有插件、运行时配置、工作树 Git 元数据、自定义账号数据及日志未进入包。清理了样例中的个人名和公司名、通往私有插件的侧栏入口，以及构建器写入 JavaScript 的临时绝对路径。扫描规则使用描述代替个人或内部值，避免将扫描词写回发布目录。

| 项 | 检查内容 | 原始命中 | 私有命中 |
| --- | --- | ---: | ---: |
| P01 | 私有项目代号 | 0 | 0 |
| P02 | 个人机器短域名 | 0 | 0 |
| P03 | 源机器用户目录全路径 | 0 | 0 |
| P04 | 个人账号拼写 | 0 | 0 |
| P05 | 公司域名关键词 | 0 | 0 |
| P06 | 公司英文名称 | 0 | 0 |
| P07 | 公司消息平台 | 0 | 0 |
| P08 | 内部模型名称 | 0 | 0 |
| P09 | 内部工具名称一 | 0 | 0 |
| P10 | 内部网关名称 | 0 | 0 |
| P11 | 内部工具名称二 | 0 | 0 |
| P12 | 公开桌面工具品牌及同形子串 | 67 | 0 |
| P13 | 个人名字的拉丁字母拼写 | 0 | 0 |
| P14 | 排除列表中的四项私有插件或脚本 | 0 | 0 |
| P15 | 排除列表中的代理选择插件 | 0 | 0 |
| P16 | 本次临时构建路径标记 | 0 | 0 |
| P17 | PEM 私钥头 | 0 | 0 |
| P18 | GitHub、OpenAI 或 AWS 的常见令牌格式 | 0 | 0 |
| P19 | 原生模块、原生可执行文件、数据库、源映射、证书、环境文件和依赖目录路径 | 0 | 0 |
| P20 | 通用用户目录与相似 API 路径 | 30 | 0 |
| P21 | BB 配对域可见子域名 | 12 | 0 |
| P22 | 个人名字的中文或分隔写法 | 0 | 0 |
| P23 | 个人笔记库路径 | 0 | 0 |
| P24 | 公司、产品和内部工具中文关键词 | 0 | 0 |

## 默认壁纸

两张 JPEG 由作者生成并授权作为发行资产。横版 `wallpaper-dark-desktop.jpg` 为 1376 × 768，竖版 `wallpaper-dark-mobile.jpg` 为 768 × 1376。用 `jpegtran -copy none` 清理，发布文件仅保留标准 JFIF 标记及 JPEG 图像数据；无 EXIF、XMP、IPTC、JPEG 注释或图像结束标记之后的数据。原图和清理后图片分别解码为 RGB，逐字节一致。两张图的 SHA-256 已加入校验清单。原有七个 tgz 和色板的 SHA-256 保持原值。

本轮对新增图片的 JPEG 段结构、文件名、文件内容，以及全部非压缩包交付文件复扫。私人或公司内网信息命中为 0。发布者授权的 GitHub 仓库名称用于下载地址。

## 本次四个插件复扫

四个包在独立的临时源码副本中构建。侧栏的私有记忆入口、个人样例，以及界面中的私有路径匹配已在副本中清理。归档成员逐个检查文件名、文件内容、UTF-16LE 字符、tar 头和原生二进制魔数。

| 插件 | 归档成员 | 私有命中 | 原生二进制 |
| --- | ---: | ---: | ---: |
| monocode-ui | 11 | 0 | 0 |
| monocode-colors | 9 | 0 | 0 |
| monocode-composer | 8 | 0 | 0 |
| monocode-sidebar | 10 | 0 | 0 |

全部 tar 成员的 UID/GID 为 0，用户名和组名为空。公开品牌匹配仍为界面包 `package/dist/app.js` 中两处 Provider 标识，以及侧栏包 `package/THIRD_PARTY_NOTICES.md` 中一处商标声明。安装器和测试脚本继续使用 7-bit ASCII。

## CatHat 套件复扫

CatHat 插件、主控工作区骨架和更新后的侧栏包均来自脱敏的临时构建输入。通用版使用用户选择的项目、provider 和模型；记忆默认位于服务端家目录下，风格文件可选。私人脚本、账号路由、固定项目 ID 和外部个人笔记目录读取已剥离。

本轮扫描覆盖全目录、解包后的 9 个 tgz、全部 918 个解码后的 Web 预压缩成员，共 2,569 个文件条目。三个新打包资产逐成员检查了匿名 tar 头、原生二进制魔数、文件名、UTF-8 和可读取的 UTF-16LE 文本。私人和公司内网信息匹配为 0，新打包资产的原生二进制为 0。

全目录复扫包含三个公开依赖匹配。核心包的 `package/server/dist/start-server.js` 含 Better Auth 的公开 OAuth provider 实现；既有界面包的 `package/dist/app.js` 与 `package/dist/server.js` 含通用文件夹图标名。对照原包校验值，两处依赖未改动。新 CatHat 包、工作区骨架与更新后的侧栏包没有命中这些词。GitHub 下载地址使用已授权的发布仓库名称。

## 经复核的公开匹配

下表列出 38 条文件与规则对应关系。同一个文件可命中多条规则。两个公开品牌资产名里的 `[e]` 表示字母 `e`。

### P12

公开的桌面打开目标、ACP 注册名称、Provider 标识和商标声明。存储保留、部分 server 和依赖 bundle 中也有“开发实例”英文标识别名的同形子串。

| 文件 | 次数 |
| --- | ---: |
| `release/bb-app-custom.tgz!package/app/dist/assets/d[e]vin-desktop-DIGMl0rE.png` | 1 |
| `release/bb-app-custom.tgz!package/app/dist/assets/index-C2FY7imn.js` | 1 |
| `release/bb-app-custom.tgz!package/app/dist/assets/index-C2FY7imn.js.br` | 1 |
| `release/bb-app-custom.tgz!package/app/dist/assets/index-C2FY7imn.js.gz` | 1 |
| `release/bb-app-custom.tgz!package/app/dist/assets/thread-detail-xVPLgfMV.js` | 7 |
| `release/bb-app-custom.tgz!package/app/dist/assets/thread-detail-xVPLgfMV.js.br` | 7 |
| `release/bb-app-custom.tgz!package/app/dist/assets/thread-detail-xVPLgfMV.js.gz` | 7 |
| `release/bb-app-custom.tgz!package/dist/index.js` | 3 |
| `release/bb-app-custom.tgz!package/host-daemon/dist/daemon-bundle.mjs` | 6 |
| `release/bb-app-custom.tgz!package/server/dist/builtin-plugins/provider-acp/dist/host.js` | 1 |
| `release/bb-app-custom.tgz!package/server/dist/builtin-plugins/provider-acp/dist/server.js` | 1 |
| `release/bb-app-custom.tgz!package/server/dist/builtin-plugins/provider-acp/icons/registry-d[e]vin.svg` | 1 |
| `release/bb-app-custom.tgz!package/server/dist/builtin-plugins/provider-acp/package.json` | 2 |
| `release/bb-app-custom.tgz!package/server/dist/builtin-plugins/provider-claude-code/dist/host.js` | 6 |
| `release/bb-app-custom.tgz!package/server/dist/builtin-plugins/storage-retention/dist/server.js` | 7 |
| `release/bb-app-custom.tgz!package/server/dist/builtin-plugins/storage-retention/skills/storage-retention/SKILL.md` | 4 |
| `release/bb-app-custom.tgz!package/server/dist/index.js` | 4 |
| `release/bb-app-custom.tgz!package/server/dist/start-server.js` | 4 |
| `release/plugins/monocode-sidebar.tgz!package/THIRD_PARTY_NOTICES.md` | 1 |
| `release/plugins/monocode-ui.tgz!package/dist/app.js` | 2 |

### P20

官方文档和 UI 的示例路径、容器镜像预设用户、公开 API 路由和隔离测试夹具。

| 文件 | 次数 |
| --- | ---: |
| `install.test.mjs` | 4 |
| `release/bb-app-custom.tgz!package/README.md` | 2 |
| `release/bb-app-custom.tgz!package/app/dist/assets/index-C2FY7imn.js` | 1 |
| `release/bb-app-custom.tgz!package/app/dist/assets/index-C2FY7imn.js.br` | 1 |
| `release/bb-app-custom.tgz!package/app/dist/assets/index-C2FY7imn.js.gz` | 1 |
| `release/bb-app-custom.tgz!package/server/dist/builtin-plugins/bb-guide/skills/bb-plugin-authoring/references/backend-sdk.md` | 5 |
| `release/bb-app-custom.tgz!package/server/dist/builtin-plugins/docs/dist/app.js` | 1 |
| `release/bb-app-custom.tgz!package/server/dist/builtin-plugins/environment-modal-sandbox/dist/Dockerfile` | 1 |
| `release/bb-app-custom.tgz!package/server/dist/builtin-plugins/mcp/dist/server.js` | 1 |
| `release/bb-app-custom.tgz!package/server/dist/builtin-plugins/provider-claude-code/dist/host.js` | 1 |
| `release/bb-app-custom.tgz!package/server/dist/builtin-plugins/workflows/dist/server.js` | 1 |
| `release/bb-app-custom.tgz!package/server/dist/builtin-skills/bb-plugin-authoring/references/backend-sdk.md` | 5 |
| `release/bb-app-custom.tgz!package/server/dist/start-server.js` | 6 |

### P21

官方 Connect 服务域名、官方文档路径样例和模拟配对测试的占位地址。

| 文件 | 次数 |
| --- | ---: |
| `install.test.mjs` | 4 |
| `release/bb-app-custom.tgz!package/server/dist/builtin-plugins/connect/dist/app.js` | 1 |
| `release/bb-app-custom.tgz!package/server/dist/builtin-plugins/connect-next/dist/server.js` | 1 |
| `release/bb-app-custom.tgz!package/server/dist/builtin-plugins/connect-next/skills/connect-next/SKILL.md` | 2 |
| `release/bb-app-custom.tgz!package/server/dist/builtin-plugins/marketplace.json` | 4 |
