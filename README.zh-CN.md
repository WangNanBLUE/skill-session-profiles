<p align="center">
  <img src="assets/logo.png" width="96" alt="Skill Session Profiles 图标">
</p>

# Skill Session Profiles

[English](README.md)

用于管理 Codex 全局与项目级 Skill 默认值、可复用配置方案，以及后续任务持续配置的
macOS 应用。

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
- 将项目专属 Skill 规则保存到所选项目根目录 `AGENTS.md` 的受管区块。
- 按 Codex 侧边栏的顺序选择本地项目。
- 通过 Codex App Server 契约管理全局 Skill 默认值。
- 支持中英文、白天与黑夜模式切换。

## 工作方式

Electron 应用通过 Codex App Server API 读写配置，不会直接修改
`~/.codex/config.toml`。

保存方案只会更新可复用模板。在“任务配置”中选择并应用后，方案的显式覆盖才会写入
用户级配置；后续编辑模板不会自动重新应用。

项目配置只保存显式覆盖。应用通过 Codex App Server 文件 API 更新项目根目录
`AGENTS.md` 中带固定标记的受管区块，并保留项目已有的其他说明。
如果项目根目录已经存在 `AGENTS.override.md`，应用会改为更新这个实际生效的文件，
因为 Codex 在同一目录中会优先读取它。

这是临时兼容方案。Codex CLI 0.140.0 虽然能够解析项目 `skills.config`，但发现插件
Skill 时不会应用项目级覆盖。项目 `AGENTS.md` 在全局规则之后加载，因此可以在不修改
全局配置的情况下，指示 Codex 不要在该项目中调用选定 Skill。需要注意，这只是指令级
控制：被停用的 Skill 仍可能出现在发现列表中；显式允许的 Skill 也必须已经安装、加载，
并在全局配置中启用。

用户数据保存在：

```text
~/.codex/skill-session-profiles
```

当前版本支持 Apple Silicon Mac 和 Windows x64。构建产物未签名，macOS 产物未公证。

## 环境要求

- Apple Silicon Mac 或 Windows x64
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
npm run dist:win
```

`test:codex-integration` 会启动真实 Codex app-server 进程，
`test:electron` 会启动真实桌面应用。两者都需要本机 Codex 可正常运行。
GitHub CI 只运行可移植的构建、单元测试和浏览器 E2E。

## 构建

```bash
npm run dist:mac
# Windows 系统：
npm run dist:win
```

macOS 的 `.app`、DMG 或 Windows 的 NSIS 安装程序会输出到 `output/`，
发布产物不提交进 Git 仓库。

## 参与贡献

欢迎提交 Issue 和 Pull Request。开始前请阅读
[贡献指南](CONTRIBUTING.md)与[行为准则](CODE_OF_CONDUCT.md)。

安全问题请通过 GitHub 私有 Security Advisory 报告，详见
[SECURITY.md](SECURITY.md)。

## 许可证

项目使用 [MIT License](LICENSE)。
