import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { createAppApi } from "./api.js";
import "./styles.css";

const root = document.getElementById("root");
if (root) {
  void Promise.resolve(createAppApi()).then(async (api) => {
    const cwd = await api.getInitialCwd?.() ?? "/";
    createRoot(root).render(<App api={api} cwd={cwd} />);
  }).catch((error) => createRoot(root).render(
    <main className="boot-error" role="alert">{String(error)}</main>,
  ));
}
