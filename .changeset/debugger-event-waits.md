---
"@statewalker/webrun-devtools": minor
---

`debugger.$once` no longer waits for ever: it rejects after a timeout (`{ timeout }`, 30 seconds by default) and when the debugger detaches. The new `debugger.sendCommandAndWait(target, method, params, event, { timeout })` listens for the event before sending the command, so `Page.navigate` on a page that loads at once no longer misses `Page.loadEventFired`. Example 03 uses it.
