import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { createPanelApi } from "./api.js";
import "./styles.css";

const root = document.getElementById("root");
if (root) {
  void createPanelApi().then(async (api) => {
    const cwd = await api.getInitialCwd?.() ?? window.__CODEX_CWD__ ?? "/";
    createRoot(root).render(<App api={api} cwd={cwd} />);
  }).catch((error) => createRoot(root).render(
    <main className="boot-error" role="alert">{String(error)}</main>,
  ));
}
