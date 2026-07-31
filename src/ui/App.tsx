import {
  AlertTriangle,
  Check,
  CircleCheck,
  CircleX,
  Copy,
  Download,
  FolderOpen,
  Globe2,
  Languages,
  Layers3,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import type { AppApi } from "./api.js";
import type {
  CodexProject,
  McpServerMetadata,
  PluginMetadata,
  ResourceOverride,
  ResourceToggleEntry,
  SkillMetadata,
  SkillOverride,
  SkillProfile,
} from "../shared/contracts.js";

type Tab = "next" | "project" | "defaults";
type ResourceKind = "plugin" | "mcp" | "skill";
type ResourceScope = "global" | "project";
type Language = "zh" | "en";
type Theme = "light" | "dark";
type ProfileDraft = {
  id?: string;
  name: string;
  overrides: SkillOverride[];
};
type State = {
  skills: SkillMetadata[];
  globalDefaults: Array<{ path: string; enabled: boolean }>;
  projectConfig: { value: Array<{ path: string; enabled: boolean }>; filePath: string };
  plugins?: PluginMetadata[];
  mcpServers?: McpServerMetadata[];
  globalPluginConfig?: ResourceToggleEntry[];
  projectPluginConfig?: { value: ResourceToggleEntry[]; filePath: string };
  globalMcpConfig?: ResourceToggleEntry[];
  projectMcpConfig?: { value: ResourceToggleEntry[]; filePath: string };
  projects: CodexProject[];
  profiles: SkillProfile[];
  activeProfileId?: string | null;
  writable: boolean;
};
type ControlResource = {
  id: string;
  name: string;
  description: string;
  source: string;
  enabled: boolean;
};

const COPY = {
  zh: {
    taskConfig: "任务配置", project: "项目配置", codexProjects: "Codex 项目", projectRoots: "项目根目录", profiles: "配置方案", defaults: "全局默认", functions: "功能",
    refresh: "刷新 Skill", closeError: "关闭错误", readOnly: "只读模式。", readOnlyDetail: "当前 Codex App Server 不支持写入 Skill 配置。",
    chooseBase: "选择基础方案", savedCount: "个已保存", inheritGlobal: "继承全局默认", noSavedProfile: "不使用已保存方案",
    defaultBehavior: "默认行为", defaultDetail: "所有新任务首先继承这里的设置。配置方案只保存明确的单项覆盖。",
    totalSkills: "Skill 总数", enabledByDefault: "默认启用", disabledByDefault: "默认停用",
    persistentDetail: "应用后，后续打开的所有 Codex 任务都会沿用此配置。",
    projectDetail: "仅对此项目生效；保存到项目根目录 AGENTS.md 的受管区块，未设置项继承全局默认。",
    profileDetail: "保存可复用的单项覆盖；未设置项始终继承全局默认。",
    import: "导入", export: "导出", profileName: "方案名称", profilePlaceholder: "例如：代码审查",
    defaultsDetail: "这里的启用状态是所有新任务和配置方案的继承基础。", enabledItems: "项启用",
    filtered: "个筛选结果", unsaved: "有未保存更改", saved: "更改已保存", defaultsSynced: "默认设置已同步",
    processing: "正在处理…", apply: "应用此配置", saveProject: "保存项目配置", saveProfile: "保存方案", saveDefaults: "保存默认设置",
    source: "来源", profileSetting: "方案设置", defaultStatus: "默认状态", setting: "设置",
    inherit: "继承", enabled: "启用", disabled: "停用", noMatch: "没有匹配的 Skill",
    noMatchDetail: "调整名称搜索或来源筛选后重试。", skillSource: "Skill 来源", allSources: "全部来源",
    user: "用户", repo: "仓库", system: "系统", admin: "管理", search: "搜索 Skill 名称",
    searchAria: "搜索 skill", clearSearch: "清空搜索", enableAll: "全部启用", disableAll: "全部禁用",
    skills: "个 Skill", switchLanguage: "Switch to English", switchTheme: "切换到黑夜模式", switchingProject: "正在切换项目…",
    plugins: "插件", mcp: "MCP", skillTab: "技能", globalScope: "全局", projectScope: "项目",
    pluginDetail: "控制已安装插件在所有后续 Codex 任务中的可用状态。",
    pluginProjectDetail: "仅控制此项目中已安装插件的启停；不新增或删除插件，未设置项继承全局配置。",
    mcpDetail: "控制已配置 MCP 服务在所有后续 Codex 任务中的可用状态。",
    mcpProjectDetail: "仅控制此项目中已配置 MCP 服务的启停；不新增或删除服务，未设置项继承全局配置。",
    saveResource: "保存配置", resource: "资源", location: "来源", resourceStatus: "状态",
    noResource: "没有匹配的资源", noResourceDetail: "调整搜索条件后重试。",
    searchResource: "搜索名称或来源", resourceSaved: "资源配置已保存。",
  },
  en: {
    taskConfig: "Task Configuration", project: "Project Configuration", codexProjects: "Codex Projects", projectRoots: "Project Root", profiles: "Profiles", defaults: "Global Defaults", functions: "Features",
    refresh: "Refresh skills", closeError: "Dismiss error", readOnly: "Read-only mode. ", readOnlyDetail: "This Codex App Server cannot write skill configuration.",
    chooseBase: "Choose base profile", savedCount: "saved", inheritGlobal: "Inherit global defaults", noSavedProfile: "Do not use a saved profile",
    defaultBehavior: "Default behavior", defaultDetail: "New tasks inherit these settings. Profiles store explicit overrides only.",
    totalSkills: "Total skills", enabledByDefault: "Enabled by default", disabledByDefault: "Disabled by default",
    persistentDetail: "After applying, all subsequently opened Codex tasks will use this configuration.",
    projectDetail: "Applies only to this project through a managed block in the project-root AGENTS.md; unset skills inherit global defaults.",
    profileDetail: "Save reusable overrides. Unset skills always inherit global defaults.",
    import: "Import", export: "Export", profileName: "Profile name", profilePlaceholder: "Example: Code review",
    defaultsDetail: "These states are inherited by new tasks and profiles.", enabledItems: "enabled",
    filtered: "filtered", unsaved: "Unsaved changes", saved: "Changes saved", defaultsSynced: "Defaults synced",
    processing: "Working…", apply: "Apply Configuration", saveProject: "Save Project Configuration", saveProfile: "Save Profile", saveDefaults: "Save Defaults",
    source: "Source", profileSetting: "Profile Setting", defaultStatus: "Default Status", setting: "settings",
    inherit: "Inherit", enabled: "Enabled", disabled: "Disabled", noMatch: "No matching skills",
    noMatchDetail: "Change the name search or source filter and try again.", skillSource: "Skill source", allSources: "All sources",
    user: "User", repo: "Repository", system: "System", admin: "Admin", search: "Search skill names",
    searchAria: "Search skills", clearSearch: "Clear search", enableAll: "Enable All", disableAll: "Disable All",
    skills: "skills", switchLanguage: "切换到中文", switchTheme: "Switch to dark mode", switchingProject: "Switching project…",
    plugins: "Plugins", mcp: "MCP", skillTab: "Skills", globalScope: "Global", projectScope: "Project",
    pluginDetail: "Control whether installed plugins are available to future Codex tasks.",
    pluginProjectDetail: "Only toggle installed plugins for this project. No plugins are added or removed; unset items inherit global configuration.",
    mcpDetail: "Control whether configured MCP servers are available to future Codex tasks.",
    mcpProjectDetail: "Only toggle configured MCP servers for this project. No servers are added or removed; unset items inherit global configuration.",
    saveResource: "Save Configuration", resource: "Resource", location: "Source", resourceStatus: "Status",
    noResource: "No matching resources", noResourceDetail: "Change the search and try again.",
    searchResource: "Search names or sources", resourceSaved: "Resource configuration saved.",
  },
};
type UiCopy = typeof COPY.zh;
const LanguageContext = createContext<Language>("zh");
const useCopy = (): UiCopy => COPY[useContext(LanguageContext)];
const SHOW_RESOURCE_CONTROLS = false;

export function App({ api, cwd }: { api: AppApi; cwd: string }) {
  const [activeCwd, setActiveCwd] = useState(cwd);
  const [tab, setTab] = useState<Tab>("next");
  const [resourceKind, setResourceKind] = useState<ResourceKind>("skill");
  const [resourceScope, setResourceScope] = useState<ResourceScope>("global");
  const [state, setState] = useState<State | null>(null);
  const [loadingCwd, setLoadingCwd] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [nextProfileId, setNextProfileId] = useState<string | null>(null);
  const [nextOverrides, setNextOverrides] = useState<SkillOverride[]>([]);
  const [projectOverrides, setProjectOverrides] = useState<SkillOverride[]>([]);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft | null>(null);
  const [defaultValues, setDefaultValues] = useState<Record<string, boolean>>({});
  const [pluginGlobalValues, setPluginGlobalValues] = useState<Record<string, boolean>>({});
  const [pluginProjectOverrides, setPluginProjectOverrides] = useState<ResourceOverride[]>([]);
  const [mcpGlobalValues, setMcpGlobalValues] = useState<Record<string, boolean>>({});
  const [mcpProjectOverrides, setMcpProjectOverrides] = useState<ResourceOverride[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>(() => readPreference("language", "zh"));
  const [theme, setTheme] = useState<Theme>(() =>
    readPreference("theme", window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  const searchRef = useRef<HTMLInputElement>(null);
  const copy = COPY[language];

  const loadState = async (targetCwd = activeCwd) => {
    const value = await api.call("get_skill_profile_state", { cwd: targetCwd });
    setState(value as unknown as State);
    setError("");
  };

  useEffect(() => {
    let active = true;
    setLoadingCwd(activeCwd);
    void api.call("get_skill_profile_state", { cwd: activeCwd })
      .then((value) => {
        if (!active) return;
        setState(value as unknown as State);
        setError("");
      })
      .catch((reason) => {
        if (active) setError(friendlyError(reason));
      })
      .finally(() => {
        if (active) setLoadingCwd(null);
      });
    return () => {
      active = false;
    };
  }, [activeCwd, api]);

  useEffect(() => {
    if (!state) return;
    setDefaultValues(Object.fromEntries(
      state.skills.map((skill) => [
        skill.path,
        state.globalDefaults.find((item) => item.path === skill.path)?.enabled ?? skill.enabled,
      ]),
    ));
    setProjectOverrides(state.projectConfig.value.map((entry) => ({
      path: entry.path,
      state: entry.enabled ? "enabled" : "disabled",
    })));
    setPluginGlobalValues(Object.fromEntries(
      (state.globalPluginConfig ?? []).map((entry) => [entry.id, entry.enabled]),
    ));
    setPluginProjectOverrides((state.projectPluginConfig?.value ?? []).map((entry) => ({
      id: entry.id,
      state: entry.enabled ? "enabled" : "disabled",
    })));
    setMcpGlobalValues(Object.fromEntries(
      (state.globalMcpConfig ?? []).map((entry) => [entry.id, entry.enabled]),
    ));
    setMcpProjectOverrides((state.projectMcpConfig?.value ?? []).map((entry) => ({
      id: entry.id,
      state: entry.enabled ? "enabled" : "disabled",
    })));
  }, [state]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    writePreference("language", language);
  }, [language]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writePreference("theme", theme);
  }, [theme]);

  const displayedSkills = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return (state?.skills ?? []).filter((skill) =>
      skill.name.toLocaleLowerCase().includes(normalizedQuery)
      && (scopeFilter === "all" || skill.scope === scopeFilter));
  }, [query, scopeFilter, state]);
  const controlResources = useMemo<ControlResource[]>(() => {
    if (resourceKind === "plugin") {
      return (state?.plugins ?? []).map((plugin) => ({
        id: plugin.id,
        name: plugin.displayName,
        description: plugin.description || plugin.id,
        source: plugin.marketplace,
        enabled: plugin.enabled,
      }));
    }
    if (resourceKind === "mcp") {
      return (state?.mcpServers ?? [])
        .filter((server) =>
          resourceScope === "project" || server.scopes?.includes("global") !== false)
        .map((server) => ({
          id: server.id,
          name: server.name,
          description: server.detail || (language === "zh" ? "已配置的 MCP 服务" : "Configured MCP server"),
          source: server.transport.toUpperCase(),
          enabled: server.enabled,
        }));
    }
    return [];
  }, [language, resourceKind, resourceScope, state]);
  const displayedResources = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return controlResources.filter((resource) =>
      `${resource.name}\n${resource.description}\n${resource.source}`
        .toLocaleLowerCase()
        .includes(normalizedQuery));
  }, [controlResources, query]);
  const inventoryPaths = useMemo(
    () => new Set((state?.skills ?? []).map((skill) => skill.path)),
    [state],
  );

  const selectedNextProfile = state?.profiles.find((item) => item.id === nextProfileId);
  const selectedProject = state?.projects.find((project) =>
    project.rootPaths.some((root) => activeCwd === root || activeCwd.startsWith(`${root}/`)));
  const selectedSavedProfile = profileDraft?.id
    ? state?.profiles.find((item) => item.id === profileDraft.id)
    : undefined;
  const profileDirty = profileDraft !== null
    && (profileDraft.id === undefined
      || profileDraft.name !== selectedSavedProfile?.name
      || overridesKey(profileDraft.overrides) !== overridesKey(selectedSavedProfile?.overrides ?? []));
  const defaultsDirty = state !== null && state.skills.some((skill) => {
    const initial = state.globalDefaults.find((item) => item.path === skill.path)?.enabled ?? skill.enabled;
    return defaultValues[skill.path] !== initial;
  });
  const currentNextOverrides = currentOverrides(nextOverrides, inventoryPaths);
  const currentProjectOverrides = currentOverrides(projectOverrides, inventoryPaths);
  const projectDirty = state !== null
    && overridesKey(projectOverrides) !== overridesKey(state.projectConfig.value.map((entry) => ({
      path: entry.path,
      state: entry.enabled ? "enabled" : "disabled",
    })));
  const pluginGlobalDirty = state !== null
    && toggleValuesKey(pluginGlobalValues, state.plugins ?? [])
      !== toggleEntriesKey(state.globalPluginConfig ?? []);
  const mcpGlobalDirty = state !== null
    && toggleValuesKey(
      mcpGlobalValues,
      (state.mcpServers ?? []).filter((server) =>
        server.scopes?.includes("global") !== false),
    )
      !== toggleEntriesKey(state.globalMcpConfig ?? []);
  const pluginProjectDirty = state !== null
    && resourceOverridesKey(pluginProjectOverrides)
      !== resourceEntriesKey(state.projectPluginConfig?.value ?? []);
  const mcpProjectDirty = state !== null
    && resourceOverridesKey(mcpProjectOverrides)
      !== resourceEntriesKey(state.projectMcpConfig?.value ?? []);
  const resourceDirty = resourceKind === "plugin"
    ? resourceScope === "global" ? pluginGlobalDirty : pluginProjectDirty
    : resourceScope === "global" ? mcpGlobalDirty : mcpProjectDirty;
  const nextStaleCount = nextOverrides.length - currentNextOverrides.length;
  const currentDraftOverrides = currentOverrides(profileDraft?.overrides ?? [], inventoryPaths);
  const draftStaleCount = (profileDraft?.overrides.length ?? 0) - currentDraftOverrides.length;

  const run = async (
    name: string,
    args: Record<string, unknown>,
    after?: (result: Record<string, unknown>) => void,
  ) => {
    setBusy(true);
    setSuccess("");
    try {
      const result = await api.call(name, args);
      after?.(result);
      await loadState();
      setError("");
      return result;
    } catch (reason) {
      setError(friendlyError(reason));
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const chooseDirectory = async () => {
    const nextCwd = await api.chooseDirectory?.();
    if (nextCwd && nextCwd !== activeCwd) {
      setActiveCwd(nextCwd);
      setNextProfileId(null);
      setNextOverrides([]);
      setProjectOverrides([]);
      setProfileDraft(null);
      setQuery("");
    }
  };

  const selectNextProfile = (profile: SkillProfile | null) => {
    setNextProfileId(profile?.id ?? null);
    setNextOverrides(profile?.overrides ?? []);
  };

  const selectProfileDraft = (profile: SkillProfile) => {
    setProfileDraft({
      id: profile.id,
      name: profile.name,
      overrides: profile.overrides,
    });
    setDeleteConfirmId(null);
  };

  const exportProfiles = async () => {
    try {
      const data = await api.call("export_skill_profiles", {});
      const content = `${JSON.stringify(data, null, 2)}\n`;
      if (api.saveTextFile) {
        await api.saveTextFile("skill-session-profiles.json", content);
        return;
      }
      const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "skill-session-profiles.json";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(friendlyError(reason));
    }
  };

  if (state === null && !error) {
    return <LoadingShell language={language} />;
  }

  const switchingProject = state !== null && loadingCwd !== null;

  return <LanguageContext.Provider value={language}><main className="desktop-shell">
    <header className="command-bar">
      <div className="brand-block">
        <span className="brand-icon" aria-hidden="true"><Layers3 size={19} /></span>
        <div>
          <strong>Skill Session Profiles</strong>
          <span>Command Deck</span>
        </div>
      </div>
      <div className="command-actions">
        <button
          type="button"
          className="icon-button language-button"
          title={copy.switchLanguage}
          aria-label={copy.switchLanguage}
          onClick={() => setLanguage((current) => current === "zh" ? "en" : "zh")}
        ><Languages size={15} /><span>{language === "zh" ? "EN" : "中"}</span></button>
        <button
          type="button"
          className="icon-button"
          title={theme === "light" ? copy.switchTheme : language === "zh" ? "切换到白天模式" : "Switch to light mode"}
          aria-label={theme === "light" ? copy.switchTheme : language === "zh" ? "切换到白天模式" : "Switch to light mode"}
          onClick={() => setTheme((current) => current === "light" ? "dark" : "light")}
        >{theme === "light" ? <Moon size={16} /> : <Sun size={16} />}</button>
        {api.chooseDirectory && <button
          type="button"
          className="context-button"
          title={activeCwd}
          onClick={() => void chooseDirectory()}
        ><FolderOpen size={16} /><span>{lastPathPart(activeCwd)}</span></button>}
        <button
          type="button"
          className="icon-button"
          title={copy.refresh}
          aria-label={copy.refresh}
          disabled={busy}
          onClick={() => void loadState().catch((reason) => setError(friendlyError(reason)))}
        ><RefreshCw size={16} /></button>
      </div>
    </header>

    {SHOW_RESOURCE_CONTROLS && <nav className="resource-tabs" aria-label={language === "zh" ? "资源类型" : "Resource type"}>
      {([
        ["plugin", copy.plugins, state?.plugins?.length ?? 0],
        ["mcp", copy.mcp, state?.mcpServers?.length ?? 0],
        ["skill", copy.skillTab, state?.skills.length ?? 0],
      ] as const).map(([kind, label, count]) => <button
        type="button"
        key={kind}
        className={resourceKind === kind ? "active" : ""}
        aria-current={resourceKind === kind ? "page" : undefined}
        onClick={() => {
          setResourceKind(kind);
          setQuery("");
          setScopeFilter("all");
        }}
      ><span>{label}</span><small>{count}</small></button>)}
    </nav>}

    <div className="state-stack">
      {error && <div className="state-banner error-banner" role="alert">
        <AlertTriangle size={17} />
        <span>{error}</span>
        <button type="button" className="bare-icon" aria-label={copy.closeError} onClick={() => setError("")}><X size={16} /></button>
      </div>}
      {success && <div className="state-banner" role="status">
        <CircleCheck size={17} />
        <span>{success}</span>
      </div>}
      {state?.writable === false && <div className="state-banner readonly-banner">
        <AlertTriangle size={17} />
        <span><strong>{copy.readOnly}</strong>{copy.readOnlyDetail}</span>
      </div>}
    </div>

    <div className="workbench">
      <aside className="sidebar">
        {resourceKind === "skill" ? <>
        <nav className="side-nav" aria-label={copy.functions}>
          <button aria-label={copy.taskConfig} aria-current={tab === "next" ? "page" : undefined} className={tab === "next" ? "active" : ""} onClick={() => setTab("next")}>
            <CircleCheck size={17} /><span>{copy.taskConfig}</span>
          </button>
          <button aria-label={copy.project} aria-current={tab === "project" ? "page" : undefined} className={tab === "project" ? "active" : ""} onClick={() => setTab("project")}>
            <FolderOpen size={17} /><span>{copy.project}</span>
            <span className="nav-count">{state?.projectConfig.value.length ?? 0}</span>
          </button>
          <button aria-label={copy.defaults} aria-current={tab === "defaults" ? "page" : undefined} className={tab === "defaults" ? "active" : ""} onClick={() => setTab("defaults")}>
            <Globe2 size={17} /><span>{copy.defaults}</span>
          </button>
        </nav>

        {tab === "next" && <ProfilesRail
          profiles={state?.profiles ?? []}
          inventoryPaths={inventoryPaths}
          selectedId={nextProfileId}
          activeId={state?.activeProfileId ?? null}
          draft={profileDraft}
          deleteConfirmId={deleteConfirmId}
          onChoose={(profile) => {
            selectNextProfile(profile);
            setProfileDraft(null);
          }}
          onCreate={() => {
            setProfileDraft({ name: "", overrides: [] });
            setDeleteConfirmId(null);
          }}
          onSelect={selectProfileDraft}
          onCopy={(profile) => void run("save_skill_profile", {
            name: `${profile.name}${language === "zh" ? " 副本" : " Copy"}`,
            overrides: profile.overrides,
          })}
          onRequestDelete={setDeleteConfirmId}
          onDelete={(profile) => void run("delete_skill_profile", { id: profile.id }, () => {
            if (nextProfileId === profile.id) selectNextProfile(null);
            if (profileDraft?.id === profile.id) setProfileDraft(null);
            setDeleteConfirmId(null);
          })}
        />}

        {tab === "defaults" && <div className="sidebar-section defaults-summary">
          <div className="sidebar-heading"><span>{copy.defaultBehavior}</span></div>
          <p>{copy.defaultDetail}</p>
          <dl>
            <div><dt>{copy.totalSkills}</dt><dd>{state?.skills.length ?? 0}</dd></div>
            <div><dt>{copy.enabledByDefault}</dt><dd>{Object.values(defaultValues).filter(Boolean).length}</dd></div>
            <div><dt>{copy.disabledByDefault}</dt><dd>{Object.values(defaultValues).filter((value) => !value).length}</dd></div>
          </dl>
        </div>}

        {tab === "project" && <ProjectRail
          projects={state?.projects ?? []}
          activeCwd={activeCwd}
          onSelect={(project) => {
            if (projectDirty && !window.confirm(language === "zh"
              ? "当前项目配置尚未保存，确定切换项目吗？"
              : "The current project configuration is unsaved. Switch projects?")) return;
            setActiveCwd(project.rootPaths[0]);
          }}
        />}
        </> : <>
          <nav className="side-nav resource-scope-nav" aria-label={language === "zh" ? "配置范围" : "Configuration scope"}>
            <button
              type="button"
              aria-current={resourceScope === "global" ? "page" : undefined}
              className={resourceScope === "global" ? "active" : ""}
              onClick={() => setResourceScope("global")}
            >
              <Globe2 size={17} /><span>{copy.globalScope}</span>
              <span className="nav-count">{controlResources.length}</span>
            </button>
            <button
              type="button"
              aria-current={resourceScope === "project" ? "page" : undefined}
              className={resourceScope === "project" ? "active" : ""}
              onClick={() => setResourceScope("project")}
            >
              <FolderOpen size={17} /><span>{copy.projectScope}</span>
              <span className="nav-count">{
                resourceKind === "plugin"
                  ? pluginProjectOverrides.length
                  : mcpProjectOverrides.length
              }</span>
            </button>
          </nav>
          {resourceScope === "project" && <ProjectRail
            projects={state?.projects ?? []}
            activeCwd={activeCwd}
            onSelect={(project) => {
              if (resourceDirty && !window.confirm(language === "zh"
                ? "当前项目配置尚未保存，确定切换项目吗？"
                : "The current project configuration is unsaved. Switch projects?")) return;
              setActiveCwd(project.rootPaths[0]);
            }}
          />}
        </>}

        <div className="scope-path" title={activeCwd}>
          <FolderOpen size={14} />
          <span>{activeCwd}</span>
        </div>
      </aside>

      <section
        className="content-pane"
        aria-busy={switchingProject}
        inert={switchingProject ? true : undefined}
      >
        {switchingProject && <div className="project-switch-progress" role="progressbar" aria-label={copy.switchingProject} />}
        {resourceKind === "skill" ? <>
        {tab === "next" && !profileDraft && <>
          <PaneHeader
            title={selectedNextProfile?.name ?? copy.inheritGlobal}
            description={copy.persistentDetail}
            count={currentNextOverrides.length}
            countLabel={language === "zh"
              ? `项当前覆盖${nextStaleCount > 0 ? ` · ${nextStaleCount} 项失效` : ""}`
              : `current overrides${nextStaleCount > 0 ? ` · ${nextStaleCount} stale` : ""}`}
            actions={<>
              <label className="secondary-button file-button" role="button" tabIndex={0}>
                <Upload size={16} />{copy.import}
                <input type="file" accept="application/json,.json" onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  await run("import_skill_profiles", {
                    data: await file.text(),
                    mode: "merge",
                    confirmed: true,
                  });
                  event.target.value = "";
                }} />
              </label>
              <button type="button" className="secondary-button" onClick={() => void exportProfiles()}>
                <Download size={16} />{copy.export}
              </button>
            </>}
          />
          <SkillWorkbench
            skills={displayedSkills}
            total={state?.skills.length ?? 0}
            query={query}
            setQuery={setQuery}
            searchRef={searchRef}
            scopeFilter={scopeFilter}
            setScopeFilter={setScopeFilter}
            overrides={nextOverrides}
            setOverride={(path, value) => setNextOverrides((current) => updateOverride(current, path, value))}
            setAll={(value) => setNextOverrides((current) =>
              applyVisibleOverrides(current, displayedSkills, value))}
          />
        </>}

        {tab === "next" && profileDraft && <>
          <PaneHeader
            title={profileDraft.id ? profileDraft.name : (language === "zh" ? "新建配置方案" : "New Profile")}
            description={copy.profileDetail}
            actions={<button type="button" className="secondary-button" onClick={() => setProfileDraft(null)}>
              <X size={16} />{language === "zh" ? "取消编辑" : "Cancel Editing"}
            </button>}
          />
          <div className="profile-editor">
                <label className="name-field">
                  <span>{copy.profileName}</span>
                  <input
                    value={profileDraft.name}
                    maxLength={80}
                    onChange={(event) => setProfileDraft({ ...profileDraft, name: event.target.value })}
                    placeholder={copy.profilePlaceholder}
                  />
                </label>
                {draftStaleCount > 0 && <div className="stale-overrides-notice" role="status">
                  <AlertTriangle size={16} />
                  <span>
                    <strong>{language === "zh"
                      ? `${draftStaleCount} 项覆盖已不在当前 Skill 列表中。`
                      : `${draftStaleCount} overrides are no longer in the current skill list.`}</strong>
                    {language === "zh" ? "清理后点击“保存方案”生效。" : "Clean them, then save the profile."}
                  </span>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setProfileDraft({
                      ...profileDraft,
                      overrides: currentDraftOverrides,
                    })}
                  >{language === "zh" ? `清理失效覆盖（${draftStaleCount}）` : `Clean Stale Overrides (${draftStaleCount})`}</button>
                </div>}
                <SkillWorkbench
                  skills={displayedSkills}
                  total={state?.skills.length ?? 0}
                  query={query}
                  setQuery={setQuery}
                  searchRef={searchRef}
                  scopeFilter={scopeFilter}
                  setScopeFilter={setScopeFilter}
                  overrides={profileDraft.overrides}
                  setOverride={(path, value) => setProfileDraft({
                    ...profileDraft,
                    overrides: updateOverride(profileDraft.overrides, path, value),
                  })}
                  setAll={(value) => setProfileDraft({
                    ...profileDraft,
                    overrides: applyVisibleOverrides(profileDraft.overrides, displayedSkills, value),
                  })}
                />
          </div>
        </>}

        {tab === "project" && <>
          <PaneHeader
            title={selectedProject?.name ?? lastPathPart(activeCwd)}
            description={copy.projectDetail}
            count={currentProjectOverrides.length}
            countLabel={language === "zh" ? "项项目覆盖" : "project overrides"}
            actions={selectedProject && selectedProject.rootPaths.length > 1
              ? <label className="project-root-select">
                  <span>{copy.projectRoots}</span>
                  <select
                    aria-label={copy.projectRoots}
                    value={selectedProject.rootPaths.find((root) =>
                      activeCwd === root || activeCwd.startsWith(`${root}/`)) ?? selectedProject.rootPaths[0]}
                    onChange={(event) => setActiveCwd(event.target.value)}
                  >
                    {selectedProject.rootPaths.map((root) =>
                      <option key={root} value={root}>{lastPathPart(root)}</option>)}
                  </select>
                </label>
              : undefined}
          />
          <SkillWorkbench
            skills={displayedSkills}
            total={state?.skills.length ?? 0}
            query={query}
            setQuery={setQuery}
            searchRef={searchRef}
            scopeFilter={scopeFilter}
            setScopeFilter={setScopeFilter}
            overrides={projectOverrides}
            setOverride={(path, value) => setProjectOverrides((current) => updateOverride(current, path, value))}
            setAll={(value) => setProjectOverrides((current) =>
              applyVisibleOverrides(current, displayedSkills, value))}
          />
        </>}

        {tab === "defaults" && <>
          <PaneHeader
            title={copy.defaults}
            description={copy.defaultsDetail}
            count={Object.values(defaultValues).filter(Boolean).length}
            countLabel={copy.enabledItems}
          />
          <DefaultsWorkbench
            skills={displayedSkills}
            total={state?.skills.length ?? 0}
            query={query}
            setQuery={setQuery}
            searchRef={searchRef}
            scopeFilter={scopeFilter}
            setScopeFilter={setScopeFilter}
            values={defaultValues}
            setValue={(path, value) => setDefaultValues((current) => ({ ...current, [path]: value }))}
            setAll={(value) => setDefaultValues((current) => ({
              ...current,
              ...Object.fromEntries(displayedSkills.map((skill) => [skill.path, value])),
            }))}
          />
        </>}
        </> : <ResourceControlPane
          kind={resourceKind}
          scope={resourceScope}
          resources={displayedResources}
          total={controlResources.length}
          query={query}
          setQuery={setQuery}
          searchRef={searchRef}
          globalValues={resourceKind === "plugin" ? pluginGlobalValues : mcpGlobalValues}
          projectOverrides={resourceKind === "plugin" ? pluginProjectOverrides : mcpProjectOverrides}
          setGlobalValue={(id, enabled) => {
            if (resourceKind === "plugin") {
              setPluginGlobalValues((current) => ({ ...current, [id]: enabled }));
            } else {
              setMcpGlobalValues((current) => ({ ...current, [id]: enabled }));
            }
          }}
          setProjectOverride={(id, value) => {
            if (resourceKind === "plugin") {
              setPluginProjectOverrides((current) => updateResourceOverride(current, id, value));
            } else {
              setMcpProjectOverrides((current) => updateResourceOverride(current, id, value));
            }
          }}
          setAll={(enabled) => {
            if (resourceScope === "global") {
              const updates = Object.fromEntries(displayedResources.map((item) => [item.id, enabled]));
              if (resourceKind === "plugin") {
                setPluginGlobalValues((current) => ({ ...current, ...updates }));
              } else {
                setMcpGlobalValues((current) => ({ ...current, ...updates }));
              }
              return;
            }
            const stateValue = enabled ? "enabled" as const : "disabled" as const;
            if (resourceKind === "plugin") {
              setPluginProjectOverrides((current) =>
                applyVisibleResourceOverrides(current, displayedResources, stateValue));
            } else {
              setMcpProjectOverrides((current) =>
                applyVisibleResourceOverrides(current, displayedResources, stateValue));
            }
          }}
        />}
      </section>
    </div>

    <footer className="status-bar" aria-live="polite">
      {resourceKind === "skill" ? <>
      <div>
        {switchingProject && <>
          <span>{copy.switchingProject}</span>
          <span className="status-separator">·</span>
        </>}
        <span>{displayedSkills.length} {copy.filtered}</span>
        <span className="status-separator">·</span>
        {tab === "next" && <span>{overrideSummary(nextOverrides, inventoryPaths, false, language)}</span>}
        {tab === "next" && profileDraft && <span>{profileDirty ? copy.unsaved : copy.saved}</span>}
        {tab === "project" && <span>{projectDirty ? copy.unsaved : copy.saved}</span>}
        {tab === "defaults" && <span>{defaultsDirty ? copy.unsaved : copy.defaultsSynced}</span>}
      </div>
      <div className="status-actions">
        {busy && <span className="saving-label">{copy.processing}</span>}
        {tab === "next" && !profileDraft && <button
          type="button"
          className="primary-button"
          disabled={busy || state?.writable === false}
          onClick={() => void run("apply_skill_configuration", {
            cwd: activeCwd,
            profileId: nextProfileId,
            overrides: currentNextOverrides,
          }, () => {
            setSuccess(language === "zh"
              ? "配置已应用。后续打开的所有任务都会沿用此配置。"
              : "Configuration applied. All subsequently opened tasks will use it.");
          })}
        ><CircleCheck size={16} />{copy.apply}</button>}
        {tab === "next" && profileDraft && <button
          type="button"
          className="primary-button"
          disabled={busy || !profileDraft?.name.trim() || !profileDirty}
          onClick={() => profileDraft && void run("save_skill_profile", {
            ...(profileDraft.id ? { id: profileDraft.id } : {}),
            name: profileDraft.name,
            overrides: profileDraft.overrides,
          }, (result) => {
            const saved = result.profile as SkillProfile;
            selectNextProfile(saved);
            setProfileDraft(null);
          })}
        ><Check size={16} />{copy.saveProfile}</button>}
        {tab === "project" && <button
          type="button"
          className="primary-button"
          disabled={busy || !projectDirty || state?.writable === false}
          onClick={() => void run("save_project_skill_configuration", {
            cwd: activeCwd,
            overrides: currentProjectOverrides,
          }, () => {
            setSuccess(language === "zh"
              ? "项目配置已保存。重新打开或派生的此项目任务会使用它。"
              : "Project configuration saved. Reopened or derived tasks for this project will use it.");
          })}
        ><Check size={16} />{copy.saveProject}</button>}
        {tab === "defaults" && <button
          type="button"
          className="primary-button"
          disabled={busy || !defaultsDirty || state?.writable === false}
          onClick={() => void run("save_global_skill_defaults", {
            cwd: activeCwd,
            value: (state?.skills ?? []).map((skill) => ({
              path: skill.path,
              enabled: defaultValues[skill.path] ?? skill.enabled,
            })),
          })}
        ><Check size={16} />{copy.saveDefaults}</button>}
      </div>
      </> : <>
        <div>
          {switchingProject && <>
            <span>{copy.switchingProject}</span>
            <span className="status-separator">·</span>
          </>}
          <span>{displayedResources.length} {copy.filtered}</span>
          <span className="status-separator">·</span>
          <span>{resourceDirty ? copy.unsaved : copy.saved}</span>
        </div>
        <div className="status-actions">
          {busy && <span className="saving-label">{copy.processing}</span>}
          <button
            type="button"
            className="primary-button"
            disabled={busy || !resourceDirty || state?.writable === false}
            onClick={() => {
              const resource = resourceKind === "plugin" ? "plugin" : "mcp";
              const globalValues = resourceKind === "plugin"
                ? pluginGlobalValues
                : mcpGlobalValues;
              const projectValues = resourceKind === "plugin"
                ? pluginProjectOverrides
                : mcpProjectOverrides;
              void run(
                resourceScope === "global"
                  ? "save_global_resource_configuration"
                  : "save_project_resource_configuration",
                {
                  cwd: activeCwd,
                  resource,
                  value: resourceScope === "global"
                    ? controlResources.map((item) => ({
                        id: item.id,
                        enabled: globalValues[item.id] ?? item.enabled,
                      }))
                    : projectValues.map((item) => ({
                        id: item.id,
                        enabled: item.state === "enabled",
                      })),
                },
                () => setSuccess(copy.resourceSaved),
              );
            }}
          ><Check size={16} />{copy.saveResource}</button>
        </div>
      </>}
    </footer>
  </main></LanguageContext.Provider>;
}

function ProjectRail({ projects, activeCwd, onSelect }: {
  projects: CodexProject[];
  activeCwd: string;
  onSelect(project: CodexProject): void;
}) {
  const copy = useCopy();
  const english = useContext(LanguageContext) === "en";
  return <div className="sidebar-section">
    <div className="sidebar-heading">
      <span>{copy.codexProjects}</span>
      <small>{projects.length}</small>
    </div>
    <div className="profile-rail">
      {projects.map((project) => {
        const selected = project.rootPaths.some((root) =>
          activeCwd === root || activeCwd.startsWith(`${root}/`));
        return <button
          type="button"
          key={project.id}
          className={selected ? "profile-item selected" : "profile-item"}
          onClick={() => onSelect(project)}
          title={project.rootPaths.join("\n")}
        >
          <span className="profile-symbol"><FolderOpen size={16} /></span>
          <span>
            <strong>{project.name}</strong>
            <small>{project.rootPaths.length === 1
              ? project.rootPaths[0]
              : english ? `${project.rootPaths.length} workspace roots` : `${project.rootPaths.length} 个工作区根目录`}</small>
          </span>
          {selected && <Check size={16} />}
        </button>;
      })}
      {projects.length === 0 && <div className="rail-empty">
        {english ? "No local Codex projects" : "没有本地 Codex 项目"}
      </div>}
    </div>
  </div>;
}

function ProfilesRail({ profiles, inventoryPaths, selectedId, activeId, draft, deleteConfirmId, onChoose, onCreate, onSelect, onCopy, onRequestDelete, onDelete }: {
  profiles: SkillProfile[];
  inventoryPaths: ReadonlySet<string>;
  selectedId: string | null;
  activeId: string | null;
  draft: ProfileDraft | null;
  deleteConfirmId: string | null;
  onChoose(profile: SkillProfile | null): void;
  onCreate(): void;
  onSelect(profile: SkillProfile): void;
  onCopy(profile: SkillProfile): void;
  onRequestDelete(id: string | null): void;
  onDelete(profile: SkillProfile): void;
}) {
  const english = useContext(LanguageContext) === "en";
  return <div className="sidebar-section profiles-section">
    <div className="sidebar-heading">
      <span>{english ? "Task Profiles" : "任务配置方案"}</span>
      <button type="button" className="icon-button compact" title={english ? "New Profile" : "新建方案"} aria-label={english ? "New Profile" : "新建方案"} onClick={onCreate}>
        <Plus size={16} />
      </button>
    </div>
    <div className="profile-rail">
      <button
        type="button"
        className={selectedId === null && draft === null ? "profile-item selected" : "profile-item"}
        onClick={() => onChoose(null)}
      >
        <span className="profile-symbol"><Globe2 size={16} /></span>
        <span>
          <strong>{english ? "Inherit global defaults" : "继承全局默认"}{activeId === null
            && <em className="active-profile-badge">{english ? "In use" : "使用中"}</em>}</strong>
          <small>{english ? "No saved profile" : "不使用已保存方案"}</small>
        </span>
        {selectedId === null && draft === null && <Check size={16} />}
      </button>
      {profiles.map((profile) => <div
        key={profile.id}
        className={draft?.id === profile.id || (draft === null && selectedId === profile.id) ? "profile-row selected" : "profile-row"}
      >
        <button className="profile-main" onClick={() => onChoose(profile)}>
          <span className="profile-symbol"><SlidersHorizontal size={16} /></span>
          <span>
            <strong>{profile.name}{activeId === profile.id
              && <em className="active-profile-badge">{english ? "In use" : "使用中"}</em>}</strong>
            <small>{overrideSummary(profile.overrides, inventoryPaths, true, english ? "en" : "zh")}</small>
          </span>
        </button>
        {deleteConfirmId === profile.id
          ? <div className="inline-confirm">
              <button type="button" onClick={() => onRequestDelete(null)}>{english ? "Keep" : "保留"}</button>
              <button type="button" className="danger-text" onClick={() => onDelete(profile)}>{english ? "Delete" : "确认删除"}</button>
            </div>
          : <div className="profile-actions">
              <button type="button" title={`${english ? "Edit" : "编辑"} ${profile.name}`} aria-label={`${english ? "Edit" : "编辑"} ${profile.name}`} onClick={() => onSelect(profile)}><Pencil size={14} /></button>
              <button type="button" title={`${english ? "Copy" : "复制"} ${profile.name}`} aria-label={`${english ? "Copy" : "复制"} ${profile.name}`} onClick={() => onCopy(profile)}><Copy size={14} /></button>
              <button type="button" title={`${english ? "Delete" : "删除"} ${profile.name}`} aria-label={`${english ? "Delete" : "删除"} ${profile.name}`} onClick={() => onRequestDelete(profile.id)}><Trash2 size={14} /></button>
            </div>}
      </div>)}
      {profiles.length === 0 && <div className="rail-empty">{english ? "No saved profiles" : "尚未保存配置方案"}</div>}
    </div>
  </div>;
}

function PaneHeader({ title, description, count, countLabel = "项覆盖", actions }: {
  title: string;
  description: string;
  count?: number;
  countLabel?: string;
  actions?: React.ReactNode;
}) {
  return <div className="pane-header">
    <div>
      <div className="pane-title-line">
        <h1>{title}</h1>
        {count !== undefined && <span className="count-label">{count} {countLabel}</span>}
      </div>
      <p>{description}</p>
    </div>
    {actions && <div className="pane-actions">{actions}</div>}
  </div>;
}

function ResourceControlPane({
  kind,
  scope,
  resources,
  total,
  query,
  setQuery,
  searchRef,
  globalValues,
  projectOverrides,
  setGlobalValue,
  setProjectOverride,
  setAll,
}: {
  kind: "plugin" | "mcp";
  scope: ResourceScope;
  resources: ControlResource[];
  total: number;
  query: string;
  setQuery(value: string): void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  globalValues: Record<string, boolean>;
  projectOverrides: ResourceOverride[];
  setGlobalValue(id: string, enabled: boolean): void;
  setProjectOverride(id: string, value: "inherit" | "enabled" | "disabled"): void;
  setAll(enabled: boolean): void;
}) {
  const copy = useCopy();
  const language = useContext(LanguageContext);
  const overrideMap = useMemo(
    () => new Map(projectOverrides.map((item) => [item.id, item.state])),
    [projectOverrides],
  );
  const title = `${scope === "global" ? copy.globalScope : copy.projectScope} · ${
    kind === "plugin" ? copy.plugins : copy.mcp
  }`;
  const description = kind === "plugin"
    ? scope === "global" ? copy.pluginDetail : copy.pluginProjectDetail
    : scope === "global" ? copy.mcpDetail : copy.mcpProjectDetail;
  const count = scope === "global"
    ? resources.filter((item) => globalValues[item.id] ?? item.enabled).length
    : projectOverrides.length;

  return <>
    <PaneHeader
      title={title}
      description={description}
      count={count}
      countLabel={scope === "global"
        ? language === "zh" ? "项启用" : "enabled"
        : language === "zh" ? "项项目覆盖" : "project overrides"}
    />
    <div className="skill-workbench">
      <ResourceFilterBar
        query={query}
        setQuery={setQuery}
        searchRef={searchRef}
        visibleCount={resources.length}
        total={total}
        onEnable={() => setAll(true)}
        onDisable={() => setAll(false)}
      />
      <div className="skill-table resource-table">
        <div className="table-head">
          <span>{copy.resource}</span><span>{copy.location}</span><span>{copy.resourceStatus}</span>
        </div>
        <div className="table-scroll">
          {resources.map((resource) => <div className="skill-row" key={resource.id}>
            <div className="skill-info">
              <strong>{resource.name}</strong>
              <span title={resource.description}>{resource.description}</span>
            </div>
            <span className="scope-label" title={resource.source}>{resource.source}</span>
            {scope === "global"
              ? <label className="toggle-control">
                  <input
                    type="checkbox"
                    aria-label={`${resource.name} ${copy.resourceStatus}`}
                    checked={globalValues[resource.id] ?? resource.enabled}
                    onChange={(event) => setGlobalValue(resource.id, event.target.checked)}
                  />
                  <span aria-hidden="true" />
                  <strong>{globalValues[resource.id] ?? resource.enabled ? copy.enabled : copy.disabled}</strong>
                </label>
              : <fieldset className="segmented-control" aria-label={`${resource.name} ${copy.setting}`}>
                  {(["inherit", "enabled", "disabled"] as const).map((choice) => <label key={choice}>
                    <input
                      type="radio"
                      checked={(overrideMap.get(resource.id) ?? "inherit") === choice}
                      onChange={() => setProjectOverride(resource.id, choice)}
                    />
                    <span>{choice === "inherit"
                      ? copy.inherit
                      : choice === "enabled" ? copy.enabled : copy.disabled}</span>
                  </label>)}
                </fieldset>}
          </div>)}
          {resources.length === 0 && <div className="table-empty">
            <Search size={20} />
            <strong>{copy.noResource}</strong>
            <span>{copy.noResourceDetail}</span>
          </div>}
        </div>
      </div>
    </div>
  </>;
}

function ResourceFilterBar({
  query,
  setQuery,
  searchRef,
  visibleCount,
  total,
  onEnable,
  onDisable,
}: {
  query: string;
  setQuery(value: string): void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  visibleCount: number;
  total: number;
  onEnable(): void;
  onDisable(): void;
}) {
  const copy = useCopy();
  const english = useContext(LanguageContext) === "en";
  return <div className="filter-bar resource-filter-bar">
    <label className="skill-search">
      <span className="sr-only">{copy.searchResource}</span>
      <Search size={15} aria-hidden="true" />
      <input
        ref={searchRef}
        aria-label={copy.searchResource}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={copy.searchResource}
      />
      {query
        ? <button type="button" className="bare-icon" aria-label={copy.clearSearch} onClick={() => setQuery("")}><X size={15} /></button>
        : <kbd>⌘K</kbd>}
    </label>
    <span className="filter-summary">{visibleCount === total ? total : `${visibleCount} / ${total}`}</span>
    <div className="bulk-actions">
      <button type="button" className="secondary-button" disabled={visibleCount === 0} onClick={onEnable}>
        <CircleCheck size={15} />{copy.enableAll}{english ? ` (${visibleCount})` : `（${visibleCount}）`}
      </button>
      <button type="button" className="secondary-button" disabled={visibleCount === 0} onClick={onDisable}>
        <CircleX size={15} />{copy.disableAll}{english ? ` (${visibleCount})` : `（${visibleCount}）`}
      </button>
    </div>
  </div>;
}

function SkillWorkbench({ skills, total, query, setQuery, searchRef, scopeFilter, setScopeFilter, overrides, setOverride, setAll }: {
  skills: SkillMetadata[];
  total: number;
  query: string;
  setQuery(value: string): void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  scopeFilter: string;
  setScopeFilter(value: string): void;
  overrides: SkillOverride[];
  setOverride(path: string, value: "inherit" | "enabled" | "disabled"): void;
  setAll(value: "enabled" | "disabled"): void;
}) {
  const copy = useCopy();
  const english = useContext(LanguageContext) === "en";
  const overrideMap = useMemo(
    () => new Map(overrides.map((item) => [item.path, item.state])),
    [overrides],
  );
  return <div className="skill-workbench">
    <FilterBar
      query={query}
      setQuery={setQuery}
      searchRef={searchRef}
      scopeFilter={scopeFilter}
      setScopeFilter={setScopeFilter}
      visibleCount={skills.length}
      total={total}
      onEnable={() => setAll("enabled")}
      onDisable={() => setAll("disabled")}
    />
    <div className="skill-table">
      <div className="table-head">
        <span>Skill</span><span>{copy.source}</span><span>{copy.profileSetting}</span>
      </div>
      <div className="table-scroll">
        {skills.map((skill) => {
          const value = overrideMap.get(skill.path) ?? "inherit";
          return <div className="skill-row" key={skill.path}>
            <div className="skill-info">
              <strong>{skill.name}</strong>
              <span title={skill.description || skill.path}>{skill.description || skill.path}</span>
            </div>
            <span className="scope-label">{copy[skill.scope]}</span>
            <fieldset className="segmented-control" aria-label={`${skill.name} ${copy.setting}`}>
              {(["inherit", "enabled", "disabled"] as const).map((choice) => <label key={choice}>
                <input type="radio" checked={value === choice} onChange={() => setOverride(skill.path, choice)} />
                <span>{choice === "inherit" ? copy.inherit : choice === "enabled" ? copy.enabled : copy.disabled}</span>
              </label>)}
            </fieldset>
          </div>;
        })}
        {skills.length === 0 && <div className="table-empty">
          <Search size={20} />
          <strong>{copy.noMatch}</strong>
          <span>{copy.noMatchDetail}</span>
        </div>}
      </div>
    </div>
  </div>;
}

function DefaultsWorkbench({ skills, total, query, setQuery, searchRef, scopeFilter, setScopeFilter, values, setValue, setAll }: {
  skills: SkillMetadata[];
  total: number;
  query: string;
  setQuery(value: string): void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  scopeFilter: string;
  setScopeFilter(value: string): void;
  values: Record<string, boolean>;
  setValue(path: string, value: boolean): void;
  setAll(value: boolean): void;
}) {
  const copy = useCopy();
  return <div className="skill-workbench">
    <FilterBar
      query={query}
      setQuery={setQuery}
      searchRef={searchRef}
      scopeFilter={scopeFilter}
      setScopeFilter={setScopeFilter}
      visibleCount={skills.length}
      total={total}
      onEnable={() => setAll(true)}
      onDisable={() => setAll(false)}
    />
    <div className="skill-table defaults-table">
      <div className="table-head"><span>Skill</span><span>{copy.source}</span><span>{copy.defaultStatus}</span></div>
      <div className="table-scroll">
        {skills.map((skill) => <div className="skill-row" key={skill.path}>
          <div className="skill-info">
            <strong>{skill.name}</strong>
            <span title={skill.description || skill.path}>{skill.description || skill.path}</span>
          </div>
          <span className="scope-label">{copy[skill.scope]}</span>
          <label className="toggle-control">
            <input
              type="checkbox"
              checked={values[skill.path] ?? skill.enabled}
              onChange={(event) => setValue(skill.path, event.target.checked)}
            />
            <span aria-hidden="true" />
            <strong>{values[skill.path] ?? skill.enabled ? copy.enabled : copy.disabled}</strong>
          </label>
        </div>)}
        {skills.length === 0 && <div className="table-empty">
          <Search size={20} />
          <strong>{copy.noMatch}</strong>
          <span>{copy.noMatchDetail}</span>
        </div>}
      </div>
    </div>
  </div>;
}

function FilterBar({ query, setQuery, searchRef, scopeFilter, setScopeFilter, visibleCount, total, onEnable, onDisable }: {
  query: string;
  setQuery(value: string): void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  scopeFilter: string;
  setScopeFilter(value: string): void;
  visibleCount: number;
  total: number;
  onEnable(): void;
  onDisable(): void;
}) {
  const copy = useCopy();
  const english = useContext(LanguageContext) === "en";
  return <div className="filter-bar">
    <label className="source-filter">
      <span className="sr-only">{copy.skillSource}</span>
      <SlidersHorizontal size={15} />
      <select aria-label={copy.skillSource} value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)}>
        <option value="all">{copy.allSources}</option>
        <option value="user">{copy.user}</option>
        <option value="repo">{copy.repo}</option>
        <option value="system">{copy.system}</option>
        <option value="admin">{copy.admin}</option>
      </select>
    </label>
    <label className="skill-search">
      <span className="sr-only">{copy.search}</span>
      <Search size={15} aria-hidden="true" />
      <input
        ref={searchRef}
        aria-label={copy.searchAria}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={copy.search}
      />
      {query
        ? <button type="button" className="bare-icon" aria-label={copy.clearSearch} onClick={() => setQuery("")}><X size={15} /></button>
        : <kbd>⌘K</kbd>}
    </label>
    <span className="filter-summary">{visibleCount === total ? `${total} ${copy.skills}` : `${visibleCount} / ${total} ${copy.skills}`}</span>
    <div className="bulk-actions">
      <button type="button" className="secondary-button" disabled={visibleCount === 0} onClick={onEnable}>
        <CircleCheck size={15} />{copy.enableAll}{english ? ` (${visibleCount})` : `（${visibleCount}）`}
      </button>
      <button type="button" className="secondary-button" disabled={visibleCount === 0} onClick={onDisable}>
        <CircleX size={15} />{copy.disableAll}{english ? ` (${visibleCount})` : `（${visibleCount}）`}
      </button>
    </div>
  </div>;
}

function LoadingShell({ language }: { language: Language }) {
  return <main className="desktop-shell loading-shell" aria-label={language === "zh" ? "正在加载 Skill 配置" : "Loading skill configuration"}>
    <header className="command-bar"><div className="skeleton brand-skeleton" /><div className="skeleton search-skeleton" /></header>
    <div className="workbench"><aside className="sidebar"><div className="skeleton nav-skeleton" /></aside><section className="content-pane"><div className="skeleton title-skeleton" /><div className="skeleton table-skeleton" /></section></div>
  </main>;
}

function updateResourceOverride(
  current: ResourceOverride[],
  id: string,
  value: "inherit" | "enabled" | "disabled",
): ResourceOverride[] {
  return value === "inherit"
    ? current.filter((item) => item.id !== id)
    : [...current.filter((item) => item.id !== id), { id, state: value }];
}

function applyVisibleResourceOverrides(
  current: ResourceOverride[],
  resources: ControlResource[],
  value: "enabled" | "disabled",
): ResourceOverride[] {
  const visibleIds = new Set(resources.map((resource) => resource.id));
  return [
    ...current.filter((item) => !visibleIds.has(item.id)),
    ...resources.map((resource) => ({ id: resource.id, state: value })),
  ];
}

function resourceOverridesKey(overrides: ResourceOverride[]): string {
  return JSON.stringify([...overrides].sort((a, b) => a.id.localeCompare(b.id)));
}

function resourceEntriesKey(entries: ResourceToggleEntry[]): string {
  return resourceOverridesKey(entries.map((entry) => ({
    id: entry.id,
    state: entry.enabled ? "enabled" : "disabled",
  })));
}

function toggleValuesKey(
  values: Record<string, boolean>,
  resources: Array<{ id: string; enabled: boolean }>,
): string {
  return toggleEntriesKey(resources.map((resource) => ({
    id: resource.id,
    enabled: values[resource.id] ?? resource.enabled,
  })));
}

function toggleEntriesKey(entries: ResourceToggleEntry[]): string {
  return JSON.stringify([...entries].sort((a, b) => a.id.localeCompare(b.id)));
}

function updateOverride(
  current: SkillOverride[],
  path: string,
  value: "inherit" | "enabled" | "disabled",
): SkillOverride[] {
  return value === "inherit"
    ? current.filter((item) => item.path !== path)
    : [...current.filter((item) => item.path !== path), { path, state: value }];
}

function applyVisibleOverrides(
  current: SkillOverride[],
  skills: SkillMetadata[],
  value: "enabled" | "disabled",
): SkillOverride[] {
  const visiblePaths = new Set(skills.map((skill) => skill.path));
  return [
    ...current.filter((item) => !visiblePaths.has(item.path)),
    ...skills.map((skill) => ({ path: skill.path, state: value })),
  ];
}

function currentOverrides(
  overrides: SkillOverride[],
  inventoryPaths: ReadonlySet<string>,
): SkillOverride[] {
  return overrides.filter((override) => inventoryPaths.has(override.path));
}

function overrideSummary(
  overrides: SkillOverride[],
  inventoryPaths: ReadonlySet<string>,
  compact = false,
  language: Language = "zh",
): string {
  const currentCount = currentOverrides(overrides, inventoryPaths).length;
  const staleCount = overrides.length - currentCount;
  if (compact) {
    return language === "zh"
      ? `${currentCount} 当前${staleCount > 0 ? ` · ${staleCount} 失效` : ""}`
      : `${currentCount} current${staleCount > 0 ? ` · ${staleCount} stale` : ""}`;
  }
  return language === "zh"
    ? `${currentCount} 项当前覆盖${staleCount > 0 ? ` · ${staleCount} 项失效` : ""}`
    : `${currentCount} current overrides${staleCount > 0 ? ` · ${staleCount} stale` : ""}`;
}

function overridesKey(overrides: SkillOverride[]): string {
  return JSON.stringify([...overrides].sort((a, b) => a.path.localeCompare(b.path)));
}

function lastPathPart(path: string): string {
  return path.split("/").filter(Boolean).at(-1) ?? "/";
}

function readPreference<T extends string>(key: string, fallback: T): T {
  try {
    return (window.localStorage.getItem(`skill-session-profiles:${key}`) as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}

function writePreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(`skill-session-profiles:${key}`, value);
  } catch {
    // Preferences remain session-local when storage is unavailable.
  }
}

function friendlyError(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : String(reason);
  if (/operation already in progress/i.test(message)) {
    return "另一项配置操作仍在进行，请稍后重试。";
  }
  if (/unknown skill path/i.test(message)) {
    return "Skill 列表已经变化。请刷新后重新保存。";
  }
  return message.replace(/^Error invoking remote method '[^']+':\s*/i, "");
}
