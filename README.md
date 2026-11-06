# ZTH Studio Forge 1.0

一个面向Windows工程工作室的环境准备助手。先检测硬件、磁盘、WSL与工具，再生成可审阅计划；由用户确认后，创建独立Ubuntu/ROS环境或运行受控的微软工具安装任务。MIT开源，公开作者为Zeruik / TechABJ。

## 可以做什么

- 只读检测Windows版本、CPU、内存、GPU、固件虚拟化、磁盘空间、管理员状态、VC++运行库、PATH中可见的编译工具以及注册的WSL发行版。
- 默认检测不启动已有WSL。用户主动选择“深入检测”并确认后，才进入指定发行版读取Ubuntu版本、`/opt/ros`与编译器位置；这可能启动该发行版，但不安装软件。
- 选择英文磁盘路径与全新的`ZTH-...`发行版名，下载Ubuntu官方rootfs，读取官方SHA256SUMS核对完整文件；也可选择本地rootfs并提供SHA-256校验。
- 通过`wsl --import ... --version 2`创建独立环境，验证实际Ubuntu版本后配置固定版本ROS官方apt-source包（1.3.0，SHA-256已列入源码），再安装ROS Base或Desktop及可选Linux C/C++工具。
- 单独准备WSL平台、Microsoft VC++ v14 x64运行库、Visual Studio 2022 C++ Build Tools。Windows安装器执行前核对有效Microsoft Authenticode签名。
- 预览准确参数与Linux脚本，导出PowerShell脚本，查看进度、取消、在同一运行会话中按检查点重试。重启应用后历史任务只供审阅，不自动继续未知状态的安装。
- 四条工程配方：YOLO分割→手眼标定→机械臂抓取；传感器→SLAM→Nav2；无人机SITL/地面站；强化学习/动作模仿。包含阶段产物、验收清单、官方资料和Markdown导出，不提供真实机器人或飞行控制。

## 版本矩阵

官方资料核对于 **2026-11-06**。日期不是软件长期兼容保证；发行版、仓库和下载地址可能变化。

| 选项 | Ubuntu | 本版行为 | 官方支持信息 |
|---|---|---|---|
| ROS 2 Jazzy | 24.04 Noble | 默认建议，可生成自动化计划 | 至2029年5月 |
| ROS 2 Humble | 22.04 Jammy | 兼容选择，可生成自动化计划 | 至2027年5月 |
| ROS 1 Noetic | 20.04 Focal | 仅遗留资料，不自动安装 | 2025-05-31已EOL |
| ROS 2 Lyrical | 以当前官方文档为准 | 官方索引已列active；本版未实现/验证自动化 | 不在本版安装支持范围 |

Jazzy/Humble平台以[ROS官方安装文档](https://docs.ros.org/en/jazzy/Installation/Ubuntu-Install-Debs.html)和[REP-2000](https://reps.openrobotics.org/rep-2000/)为依据；Humble支持期见[官方发布说明](https://www.openrobotics.org/blog/2022/5/24/ros-2-humble-hawksbill-release)。Noetic对应Focal见[官方发行描述](https://github.com/ros/rosdistro/blob/master/noetic/distribution.yaml)，停止支持日期见[ROS项目公告](https://discourse.ros.org/t/ros-noetic-end-of-life-may-31-2025/43160)。所有发行状态可查[rosdistro索引](https://github.com/ros/rosdistro/blob/master/index-v4.yaml)。

**不会把Noetic安装到Jammy/Noble，也不通过强改系统版本伪装兼容。** ROS1旧项目应先备份并评估迁移；是否维持隔离的遗留环境由项目负责人决定。

## 使用流程

1. 打开桌面版，点击“检测这台电脑”。结果不会上传。
2. WSL缺失时先生成WSL平台计划。此步骤需要管理员，并可能需要手动重启；不会自动安装默认Ubuntu，也不会自动重启电脑。
3. 检测WSL可用后，在“Ubuntu与ROS”选择组合、新名称与独立英文目录。建议为发行版和缓存预留至少20GB。
4. 查看计划中的URL、准确参数、系统变化和回滚限制。选择导出PowerShell审阅，或点击执行并通过原生确认。
5. 安装完成后独立验证。导入的发行版初始使用root，应创建普通Linux用户用于日常开发；每个终端手动`source /opt/ros/jazzy/setup.bash`（Humble换成humble），本助手不写入`.bashrc`。

目前Windows系统任务需要以管理员身份运行应用，或导出脚本后在管理员PowerShell运行。Forge不会静默提权。导出的脚本也要求输入`APPLY`才执行。

本地缓存使用原生文件选择器，格式为tar.gz、tar或.wsl；ISO不是rootfs。填写所选镜像**对应架构与版本**的官方SHA-256。校验只能证明文件与给定摘要一致，不能把来源不明的摘要变成可信来源。缓存复制到应用数据目录的`Cache/`，重建计划时仍会核对文件；本版缓存导入记录只在当前会话有效，重启后可重新选择已有文件。

## 现有环境与取消

现有发行版不会被覆盖或卸载；Linux安装计划必须使用新名称和新目录。程序不调用`wsl --unregister`、`wsl --shutdown`，不更换默认发行版，不修改全局PATH，也不覆盖用户Shell启动文件。第三方安装器会进行自身所需的Windows注册与组件安装，不能视为纯文件解压。

取消下载会停止传输；包管理器或系统安装器开始后，取消会等待当前步骤结束再停止。强制结束应用仍可能留下部分安装，**取消不是回滚**。同会话重试从已完成检查点继续；WSL导入失败可能已产生部分注册，不自动重试覆盖，需要先检查状态。任务日志保存每一步结果。重新启动应用后只显示历史，不自动恢复安装。

卸载Forge只移除助手自身，不移除WSL、Ubuntu发行版、ROS、VC++或Build Tools。它们可能承载其他项目，应通过对应官方方式另行管理。不要为了清理磁盘直接删除发行版目录；这可能损坏或毁掉全部Linux资料。应用不提供自动恢复系统变更的承诺。

## 网络、隐私与离线边界

桌面Electron运行时可以随发行包提供。WSL、Ubuntu、ROS和微软C++大体积组件没有预装在本源码或助手包内；默认下载需要网络，ROS apt安装仍需软件源网络。本地rootfs导入只能减少镜像下载，不能让整条安装路线完全离线。没有浏览器爬取或隐蔽后台更新。

下载只允许固定官方HTTPS地址；Ubuntu校验官方SHA256SUMS，ROS apt-source固定资产哈希，Windows安装器校验Microsoft签名。网络服务能获取常规请求IP与连接信息。启用严格网络策略或企业代理时可能失败，程序报告错误，不退回不可信镜像。

硬件检测、电脑路径、生成计划与任务日志均保存在本机或内存，可能包含个人目录。没有云账户、遥测或作者后台。分享脚本/日志前检查路径与敏感信息。清单勾选仅保存在本地站点存储，不能作为第三方认证或机器人安全结论。

## 架构与复现

本目录前端为静态HTML/CSS/JavaScript，不需要前端打包器。`catalog.cjs`是官方版本、下载规则与配方数据；`catalog-browser.js`是其浏览器快照。`backend.cjs`使用Node标准库，提供检测、校验、固定动作计划与任务状态；不接受任意命令字符串。详细IPC合同见[API.md](API.md)。Electron安全壳由上层发布工程提供，必须使用contextIsolation、sandbox、无nodeIntegration和逐方法IPC。

在包含本目录的工作区，用Node.js22.22.2+执行：

```powershell
node studio-products/forge/qa.cjs
node studio-products/forge/qa-ui.cjs
```

`qa.cjs`不依赖第三方包，使用临时目录、模拟执行器和模拟下载；所有系统安装都被替换，不执行WSL安装/重启/环境修改。`qa-ui.cjs`使用JSDOM30.1.3；默认查找工作区的`qa/dom-runtime/node_modules/jsdom/lib/api.js`，独立取出目录时通过`ZTH_JSDOM_MODULE`环境变量指定已安装JSDOM的绝对入口路径。该环境变量仅用于当前测试进程，不要求写入全局配置。

更新catalog后同步浏览器快照：

```js
const fs = require('fs');
const c = require('./catalog.cjs');
fs.writeFileSync('catalog-browser.js', 'window.ForgeCatalog=' + JSON.stringify({
  version:'1.0.0', verifiedAt:c.VERIFIED, matrix:c.matrix, sources:c.sources, recipes:c.recipes
}) + ';');
```

Mock与DOM通过不能证明某一台真实电脑的WSL安装、企业策略、代理、驱动或ROS运行成功。当前开发验收未改动用户的WSL、Ubuntu、系统组件、全局PATH或重启状态；真实执行需要在适合安装测试的Windows10/11机器独立验收。兼容入口参考[微软WSL安装要求](https://learn.microsoft.com/en-us/windows/wsl/install)；当前流程要求Windows10 build19041+或Windows11，WSL2还取决于虚拟化和系统功能。

## 许可与联系

Forge代码按[MIT License](LICENSE)发布。Electron、Ubuntu、WSL、ROS、微软工具及外部工程框架遵循各自许可；链接到YOLO、OpenCV、Nav2、MoveIt或RL工具不表示其许可变为MIT，也不表示官方认证本助手。品牌沿用工作室提供的ZTH图形，蓝色用于区分Forge产品。

©2026 Zeruik / TechABJ · 联系：zeruik@qq.com

## 界面语言 / Interface language

顶部 EN / 中文随时切换导航、表单、方案摘要和四份工程配方，保留正在输入的路径和选项。系统命令、原始诊断输出、路径和用户输入保持原文，避免翻译改变其含义。语言偏好仅保存在本机。

The top language button switches interface and workflow text while retaining entered paths and options. Commands, raw system diagnostics, paths and inputs remain unchanged. The preference stays on this device. Run `node qa-i18n.cjs` with the same JSDOM module configuration to check both languages and all plan types.

## English overview

ZTH Studio Forge is a local Windows engineering environment assistant. It detects hardware, disks, WSL registrations and available tools, then builds reviewable fixed-action plans. New ROS environments use separate ZTH-named WSL2 distributions; existing environments are never overwritten. Jazzy/Ubuntu24.04 is the default supported pair, Humble/22.04 is available, Noetic/20.04 is EOL reference-only, and Lyrical is not automated in this version. Sources were checked on 2026-11-06.

Execution needs an explicit native confirmation. Downloads are restricted to official addresses; Ubuntu and ROS repository packages use SHA-256 checks, Microsoft installers use Authenticode checks. Plans can be exported as PowerShell scripts. Cancellation stops at safe installer boundaries and does not undo completed changes. Restarted sessions retain reviewable logs but never blindly resume system changes. Uninstalling Forge does not remove installed environments.

The desktop runtime is bundled separately by the release builder. Large system packages still need a network or a compatible local import; the complete setup is **not fully offline**. Workflow recipes provide staged checks for vision/grasping, SLAM/Nav2, SITL/ground stations and RL/imitation, without real robot or flight control. MIT applies to Forge, not third-party software. QA covers mock/DOM behavior, the real Electron sandbox/preload/native confirmation/Blob export, and isolated small Inno installation/update/uninstall fixtures. WSL, ROS and compiler installation remain mock-only; this does not claim real environment or hardware validation.

## Desktop release reproduction

A staged public source folder includes BUILD.md, the pinned build-runtime lockfile and build-release.cjs. Follow BUILD.md to regenerate its Electron payload, Inno installer and ZIP. Product data lives in a separate AppData folder and is retained on uninstall. The independent installer does not run Forge environment tasks.
