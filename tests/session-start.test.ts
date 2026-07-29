import { describe, expect, it, vi } from "vitest";

import { runSessionStart } from "../src/hook/session-start.js";

describe("runSessionStart", () => {
  it.each(["clear", "compact"])("does not consume on %s", async (source) => {
    const client = { close: vi.fn() };
    const store = { readPending: vi.fn() };
    const result = await runSessionStart(
      { hook_event_name: "SessionStart", session_id: "s1", cwd: "/repo", source },
      { client: client as never, store: store as never },
    );
    expect(result).toEqual({ consumed: false });
    expect(store.readPending).not.toHaveBeenCalled();
  });
});
