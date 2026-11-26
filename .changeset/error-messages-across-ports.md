---
"@statewalker/webrun-devtools": patch
---

Errors keep their message across the page port: the extension sends a rejected call's error as `{ name, message, code, stack }`, so the page gets an `Error` with Chrome's own message (for example "No tab with id: 1.") or the authorization message for a wrong API key, instead of "[object Object]". Errors thrown by page listeners reach the extension the same way.
