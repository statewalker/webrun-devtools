// Loads the built extension (dist/webrun-devtools-extension) into Playwright's Chromium,
// headless, and serves test pages from a local HTTP server. `channel: "chromium"` is what
// makes a headless Chromium load extensions (the default headless shell loads none);
// branded Chrome ignores --load-extension. Research: statewalker-root
// docs/research/webrun-devtools-debugging.md.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(import.meta.dirname, "../..");
export const extensionDir = join(root, "dist/webrun-devtools-extension");
export const clientBundle = join(root, "dist/webrun-devtools.js");
export const API_KEY = "e2e-test-key";

/**
 * Reads an example page with its client import pointed at the locally built client
 * (the examples import it from unpkg).
 * @param {string} name e.g. "01.screenshot.html"
 */
export async function readExample(name) {
  const html = await readFile(join(root, "examples", name), "utf8");
  return html.replace(
    /https:\/\/unpkg\.com\/@statewalker\/webrun-devtools(@[^"']*)?/g,
    "/webrun-devtools.js",
  );
}

/**
 * Serves `/webrun-devtools.js` (the built client) and the given pages by path.
 * @param {Record<string, string | ((req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void)>} pages
 * HTML by path, e.g. { "/": "<html>..." }, or a handler answering the request itself
 */
export async function serve(pages) {
  const client = await readFile(clientBundle);
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (path === "/webrun-devtools.js") {
      res.writeHead(200, { "content-type": "text/javascript" });
      res.end(client);
    } else if (typeof pages[path] === "function") {
      pages[path](req, res);
    } else if (path in pages) {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(pages[path]);
    } else {
      res.writeHead(404).end();
    }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", () => done(undefined)));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise((done) => server.close(() => done(undefined))),
  };
}

/**
 * Starts Chromium with the extension and stores the test API key where the popup does
 * (idb-keyval's default store in the service worker's IndexedDB).
 */
export async function launchWithExtension() {
  const userDataDir = await mkdtemp(join(tmpdir(), "webrun-devtools-e2e-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  });
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 10000 });
  await worker.evaluate(
    (key) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("keyval-store");
        open.onupgradeneeded = () => open.result.createObjectStore("keyval");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction("keyval", "readwrite");
          tx.objectStore("keyval").put(key, "webrun-devtools-keys");
          tx.oncomplete = () => resolve(undefined);
          tx.onerror = () => reject(tx.error);
        };
      }),
    API_KEY,
  );
  return {
    context,
    worker,
    close: async () => {
      await context.close();
      await rm(userDataDir, { recursive: true, force: true });
    },
  };
}
