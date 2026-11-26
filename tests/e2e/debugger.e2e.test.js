import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_KEY, launchWithExtension, serve } from "./extension-harness.js";

// The page under test drives the extension through the built client, as a user's page does.
const RUNNER = `<!doctype html><title>runner</title><script type="module">
import initDevTools from "/webrun-devtools.js";
window.navigateAndWait = async (url, times) => {
  const api = await initDevTools({ apiKey: ${JSON.stringify(API_KEY)} });
  try {
    const tab = await api.tabs.create({ url: "about:blank" });
    const target = { tabId: tab.id };
    await api.debugger.attach(target, "1.3");
    const titles = [];
    try {
      await api.debugger.sendCommand(target, "Page.enable");
      for (let i = 0; i < times; i++) {
        await api.debugger.sendCommandAndWait(
          target, "Page.navigate", { url: url + "?run=" + i }, "Page.loadEventFired", { timeout: 5000 });
        const { result } = await api.debugger.sendCommand(target, "Runtime.evaluate", { expression: "document.title" });
        titles.push(result.value);
      }
    } finally {
      await api.debugger.detach(target);
      await api.tabs.remove(tab.id);
    }
    return titles;
  } finally { await api.close(); }
};
window.waitForNothing = async () => {
  const api = await initDevTools({ apiKey: ${JSON.stringify(API_KEY)} });
  const tab = await api.tabs.create({ url: "about:blank" });
  const target = { tabId: tab.id };
  await api.debugger.attach(target, "1.3");
  const started = Date.now();
  try {
    await api.debugger.$once(target, "Page.loadEventFired", { timeout: 300 });
    return { settled: "resolved" };
  } catch (error) {
    return { settled: "rejected", afterMs: Date.now() - started };
  } finally {
    await api.debugger.detach(target);
    await api.tabs.remove(tab.id);
    await api.close();
  }
};
</script>`;

// Loads at once: no subresources, so the load event can fire before Page.navigate returns.
const INSTANT = "<!doctype html><title>instant</title>";

describe("debugger waits in the real extension (statewalker/webrun-devtools#20)", () => {
  let server, browser, page;
  beforeAll(async () => {
    server = await serve({ "/": RUNNER, "/instant": INSTANT });
    browser = await launchWithExtension();
    page = await browser.context.newPage();
    await page.goto(`${server.base}/`);
  });
  afterAll(async () => {
    await browser?.close();
    await server?.close();
  });

  it("sendCommandAndWait resolves for pages that load at once, every time", async () => {
    const titles = await page.evaluate(
      ([url, times]) => window.navigateAndWait(url, times),
      [`${server.base}/instant`, 20],
    );
    expect(titles).toEqual(Array(20).fill("instant"));
  });

  it("$once rejects after its timeout when the event never comes", async () => {
    const outcome = await page.evaluate(() => window.waitForNothing());
    expect(outcome.settled).toBe("rejected");
    expect(outcome.afterMs).toBeGreaterThanOrEqual(250);
  });
});
