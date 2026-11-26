---
"@statewalker/webrun-devtools": patch
---

Examples 00, 01 and 02 wait for the tab to finish loading (`tabs.onUpdated` with `status: "complete"`, listened for before the tab is opened or navigated) instead of sleeping a fixed time before `captureVisibleTab`, which failed on slow pages. The README notes that `captureVisibleTab` needs a loaded http(s) page and refuses `data:` URLs.
