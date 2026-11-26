import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_KEY, launchWithExtension, readExample, serve } from "./extension-harness.js";

// A page that answers late, so its tab stays loading for a while: a fixed sleep shorter
// than the delay captures a loading tab, which captureVisibleTab refuses.
// captureVisibleTab also refuses data: URLs, hence an http page.
const SLOW_DELAY = 1200;
const slowPage = (color) => (_req, res) => {
  setTimeout(() => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(`<!doctype html><title>${color}</title><body style="margin:0;background:${color}">`);
  }, SLOW_DELAY);
};

// The color at the middle of an <img>, read through a canvas.
async function centerColors(page) {
  return await page.evaluate(() =>
    [...document.querySelectorAll("#screenshots img")].map((img) => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const [r, g, b] = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
      return [r, g, b];
    }),
  );
}

describe("examples wait for the tab to load (statewalker/webrun-devtools#22)", () => {
  let server, browser;
  beforeAll(async () => {
    server = await serve({
      "/01": await readExample("01.screenshot.html"),
      "/02": await readExample("02.screenshots-many.html"),
      "/red": slowPage("rgb(255, 0, 0)"),
      "/blue": slowPage("rgb(0, 0, 255)"),
    });
    browser = await launchWithExtension();
  });
  afterAll(async () => {
    await browser?.close();
    await server?.close();
  });

  async function openExample(path) {
    const page = await browser.context.newPage();
    page.on("dialog", (dialog) => dialog.accept(API_KEY));
    await page.goto(`${server.base}${path}`);
    return page;
  }

  it("example 01 captures a slow page once it has loaded, repeatedly", async () => {
    const page = await openExample("/01");
    for (let run = 1; run <= 3; run++) {
      await page.fill("#url", `${server.base}/red?run=${run}`);
      await page.click("#btn-run");
      await page.waitForFunction(
        (count) =>
          document.querySelectorAll("#screenshots img").length >= count ||
          document.querySelector("#screenshots strong"),
        run,
        { timeout: 20000 },
      );
      expect(await page.textContent("#screenshots")).not.toContain("Error:");
      await page.waitForFunction(() =>
        [...document.querySelectorAll("#screenshots img")].every((img) => img.complete),
      );
    }
    expect(await centerColors(page)).toEqual(Array(3).fill([255, 0, 0]));
    await page.close();
  });

  it("example 02 captures each slow page once it has loaded", async () => {
    const page = await openExample("/02");
    const urls = [`${server.base}/red`, `${server.base}/blue`, `${server.base}/red?again`];
    await page.fill("#urls", urls.join("\n"));
    await page.click("#btn-run");
    await page.waitForFunction(
      (count) =>
        document.querySelectorAll("#screenshots img").length >= count &&
        [...document.querySelectorAll("#screenshots img")].every((img) => img.complete),
      urls.length,
      { timeout: 30000 },
    );
    expect(await centerColors(page)).toEqual([
      [255, 0, 0],
      [0, 0, 255],
      [255, 0, 0],
    ]);
    await page.close();
  });
});
