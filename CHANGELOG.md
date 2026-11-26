# @statewalker/webrun-devtools

## 0.2.0

### Minor Changes

- 0a1011a: `debugger.$once` no longer waits for ever: it rejects after a timeout (`{ timeout }`, 30 seconds by default) and when the debugger detaches. The new `debugger.sendCommandAndWait(target, method, params, event, { timeout })` listens for the event before sending the command, so `Page.navigate` on a page that loads at once no longer misses `Page.loadEventFired`. Example 03 uses it.

### Patch Changes

- f1609aa: Errors keep their message across the page port: the extension sends a rejected call's error as `{ name, message, code, stack }`, so the page gets an `Error` with Chrome's own message (for example "No tab with id: 1.") or the authorization message for a wrong API key, instead of "[object Object]". Errors thrown by page listeners reach the extension the same way.
- c8c1042: Examples 00, 01 and 02 wait for the tab to finish loading (`tabs.onUpdated` with `status: "complete"`, listened for before the tab is opened or navigated) instead of sleeping a fixed time before `captureVisibleTab`, which failed on slow pages. The README notes that `captureVisibleTab` needs a loaded http(s) page and refuses `data:` URLs.

## 0.1.7

### Patch Changes

- 1fdad92: Ship type declarations for the main entry point (`types`: `dist/types/api-client/index.d.ts`), generated from the JavaScript sources, and type the re-exported `newRegistry` locally, since `@statewalker/utils` (bundled, not a dependency) has no types.

## 0.1.6

### Patch Changes

- Release of the changes since the last published version:
  
  - semver ^7.5.4 -> ^7.8.5
  - files changed: dist/webrun-devtools-extension.zip, dist/webrun-devtools-ws.js, dist/webrun-devtools.js, examples/00.screenshot-min.html, examples/01.screenshot.html, 22 more
