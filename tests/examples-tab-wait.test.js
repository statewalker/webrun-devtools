import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { newFakeEvent } from "./fake-chrome.js";

// The examples are standalone pages, so their `runAndWaitForTab` helper is read from the
// HTML and compiled here, then driven with a fake `api.tabs.onUpdated`.
async function loadHelper(example) {
  const html = await readFile(join(import.meta.dirname, "..", "examples", example), "utf8");
  const start = html.indexOf("async function runAndWaitForTab");
  const end = html.indexOf("\n      }\n", start);
  expect(start).toBeGreaterThan(0);
  return new Function(`return (${html.slice(start, end + 8)});`)();
}

function newFakeApi() {
  const onUpdated = newFakeEvent();
  return {
    onUpdated,
    api: {
      tabs: {
        onUpdated: {
          addListener: async (listener) => onUpdated.addListener(listener),
          removeListener: async (listener) => onUpdated.removeListener(listener),
        },
      },
    },
  };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe.each(["01.screenshot.html", "02.screenshots-many.html"])(
  "runAndWaitForTab in %s (statewalker/webrun-devtools#22)",
  (example) => {
    it("ignores a late complete of the previous page and waits for the new load", async () => {
      const runAndWaitForTab = await loadHelper(example);
      const { api, onUpdated } = newFakeApi();
      let settled = false;
      const wait = runAndWaitForTab(api, async () => {
        // The previous page's "complete" arrives after the listener is added.
        onUpdated.dispatch(5, { status: "complete" });
        return 5;
      }).then(() => (settled = true));
      await tick();
      expect(settled).toBe(false);
      onUpdated.dispatch(5, { status: "loading" });
      await tick();
      expect(settled).toBe(false);
      onUpdated.dispatch(5, { status: "complete" });
      await wait;
      expect(onUpdated.hasListeners()).toBe(false);
    });

    it("sees a load that finishes before the action returns the tab id", async () => {
      const runAndWaitForTab = await loadHelper(example);
      const { api, onUpdated } = newFakeApi();
      await runAndWaitForTab(api, async () => {
        onUpdated.dispatch(9, { status: "loading" });
        onUpdated.dispatch(9, { status: "complete" });
        return 9;
      });
      expect(onUpdated.hasListeners()).toBe(false);
    });

    it("rejects after its timeout and stops listening", async () => {
      const runAndWaitForTab = await loadHelper(example);
      const { api, onUpdated } = newFakeApi();
      await expect(runAndWaitForTab(api, async () => 3, { timeout: 20 })).rejects.toThrow(
        "The tab did not finish loading in 20 ms.",
      );
      expect(onUpdated.hasListeners()).toBe(false);
    });
  },
);
