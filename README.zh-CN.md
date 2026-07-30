<p align="center">
  <img src="assets/logo.png" width="96" alt="Skill Session Profiles 图标">
</p>

# Skill Session Profiles

[English](README.md)

用于管理 Codex 全局与项目级 Skill 默认值、可复用配置方案，以及后续任务持续配置的
macOS 应用和 Codex 插件。

## 下载

从 [GitHub Releases](https://github.com/blueroy00/skill-session-profiles/releases/latest)
下载最新 Apple Silicon 版本。当前构建尚未签名和公证。

## 应用截图

### 任务配置

[![任务配置](docs/images/task-configuration.png)](docs/images/task-configuration.png)

### 任务配置内的方案编辑

[![可复用配置方案](docs/images/profile-editor.png)](docs/images/profile-editor.png)

### 黑夜模式

[![黑夜模式](docs/images/dark-theme.png)](docs/images/dark-theme.png)

## 功能

- 浏览已安装的 Codex Skill，并按名称或来源筛选。
- 对当前筛选结果执行全部启用或全部禁用。
- 直接在“任务配置”中选择、新建、编辑、复制、删除、导入和导出可复用方案。
- 将方案保存为可复用模板，再明确应用到全局默认值之上，供后续打开的任务使用。
- 将项目专属覆盖保存到所选项目的 `.codex/config.toml`。
- 按 Codex 侧边栏的顺序选择本地项目。
- 通过 Codex App Server 契约管理全局 Skill 默认值。
- 支持中英文、白天与黑夜模式切换。
- 独立应用与 Codex 插件共享配置方案数据。

## 工作方式

Electron 独立应用和 MCP 面板共用同一套后端与本地数据目录。所有配置写入均通过
Codex App Server API 完成，项目不会直接修改 `~/.codex/config.toml`。

保存方案只会更新可复用模板。在“任务配置”中选择并应用后，方案的显式覆盖才会写入
用户级配置；后续编辑模板不会自动重新应用。

项目配置只保存显式覆盖。应用通过 Codex App Server 文件 API 更新对应表，并保留
无关的 TOML 配置与注释；未设置的 Skill 继续继承全局默认值。启动 Hook 会将保存的
项目层转换成当前任务的权威 Skill 策略，因此即使 Codex 版本能够解析项目级
`skills.config`、却未在 Skill 发现阶段应用它，项目配置仍会生效。

用户数据保存在：

```text
~/.codex/skill-session-profiles
```

当前版本仅支持 Apple Silicon Mac，构建产物未签名、未公证。

## 环境要求

- Apple Silicon Mac
- Node.js 22.22.2
- 已安装 Codex CLI，且可通过 `PATH` 调用

## 本地开发

```bash
npm ci
npm run desktop
```

常用命令：

```bash
npm run build
npm test
npm run test:e2e
npm run test:codex-integration
npm run test:electron
npm run dist:mac
```

`test:codex-integration` 会启动真实 Codex app-server 进程，
`test:electron` 会启动真实桌面应用。两者都需要本机 Codex 可正常运行。
GitHub CI 只运行可移植的构建、单元测试和浏览器 E2E。

## 构建

```bash
npm run dist:mac
```

`.app` 和 DMG 会输出到 `output/`，发布产物不提交进 Git 仓库。

## 参与贡献

欢迎提交 Issue 和 Pull Request。开始前请阅读
[贡献指南](CONTRIBUTING.md)与[行为准则](CODE_OF_CONDUCT.md)。

安全问题请通过 GitHub 私有 Security Advisory 报告，详见
[SECURITY.md](SECURITY.md)。

## 许可证

项目使用 [MIT License](LICENSE)。
