import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_KEY, launchWithExtension, serve } from "./extension-harness.js";

const RUNNER = `<!doctype html><title>runner</title><script type="module">
import initDevTools from "/webrun-devtools.js";
const describe = (error) => ({
  isError: error instanceof Error,
  name: error?.name,
  message: error?.message,
});
window.connectWithKey = async (apiKey) => {
  try {
    const api = await initDevTools({ apiKey });
    await api.close();
    return { settled: "resolved" };
  } catch (error) {
    return { settled: "rejected", ...describe(error) };
  }
};
window.getMissingTab = async (tabId) => {
  const api = await initDevTools({ apiKey: ${JSON.stringify(API_KEY)} });
  try {
    await api.tabs.get(tabId);
    return { settled: "resolved" };
  } catch (error) {
    return { settled: "rejected", ...describe(error) };
  } finally {
    await api.close();
  }
};
</script>`;

describe("errors reach the page with their message (statewalker/webrun-devtools#21)", () => {
  let server, browser, page;
  beforeAll(async () => {
    server = await serve({ "/": RUNNER });
    browser = await launchWithExtension();
    page = await browser.context.newPage();
    await page.goto(`${server.base}/`);
  });
  afterAll(async () => {
    await browser?.close();
    await server?.close();
  });

  it("a wrong API key rejects with the authorization message", async () => {
    const outcome = await page.evaluate(() => window.connectWithKey("not-the-key"));
    expect(outcome).toEqual({
      settled: "rejected",
      isError: true,
      name: "Error",
      message: "The page is not authorized to establish connection with this extension.",
    });
  });

  it("a failing Chrome API call rejects with Chrome's own message", async () => {
    const outcome = await page.evaluate(() => window.getMissingTab(987654321));
    expect(outcome).toMatchObject({
      settled: "rejected",
      isError: true,
      message: "No tab with id: 987654321.",
    });
  });
});
