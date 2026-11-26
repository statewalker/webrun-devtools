/** How long a wait for a debugger event lasts when the caller gives no timeout. */
export const DEFAULT_EVENT_TIMEOUT = 30 * 1000;

/**
 * Tells whether a `chrome.debugger` event source is the debuggee the caller named:
 * every identifier the target gives (`tabId`, `targetId`, `extensionId`) must match.
 * @param {chrome.debugger.Debuggee} target
 * @param {chrome.debugger.Debuggee} source
 */
function isTarget(target, source) {
  const keys = ["tabId", "targetId", "extensionId"].filter((key) => target?.[key] !== undefined);
  return keys.length > 0 && keys.every((key) => source?.[key] === target[key]);
}

/**
 * Starts listening for one debugger event of the target right away, so an event fired
 * before the caller awaits is not lost. The wait rejects after `timeout` milliseconds
 * (0 or less: never) and when the debugger detaches from the target.
 * @param {chrome.debugger.Debuggee} target
 * @param {string} event the CDP event name, e.g. "Page.loadEventFired"
 * @param {{ timeout?: number }} [options]
 * @returns {{ promise: Promise<{ method: string, params: unknown }>, cancel: () => void }}
 */
export function waitForDebuggerEvent(target, event, { timeout = DEFAULT_EVENT_TIMEOUT } = {}) {
  let cancel = () => {};
  const promise = new Promise((resolve, reject) => {
    let timerId;
    const onEvent = (source, method, params) => {
      if (method !== event || !isTarget(target, source)) return;
      finish();
      resolve({ method, params });
    };
    const onDetach = (source, reason) => {
      if (!isTarget(target, source)) return;
      finish();
      reject(new Error(`The debugger detached (${reason}) while waiting for "${event}".`));
    };
    const finish = () => {
      clearTimeout(timerId);
      chrome.debugger.onEvent.removeListener(onEvent);
      chrome.debugger.onDetach.removeListener(onDetach);
    };
    chrome.debugger.onEvent.addListener(onEvent);
    chrome.debugger.onDetach.addListener(onDetach);
    if (timeout > 0) {
      timerId = setTimeout(() => {
        finish();
        reject(
          new Error(`Timed out after ${timeout} ms waiting for the debugger event "${event}".`),
        );
      }, timeout);
    }
    cancel = () => {
      finish();
      reject(new Error(`The wait for the debugger event "${event}" was cancelled.`));
    };
  });
  // A cancelled wait nobody awaits must not surface as an unhandled rejection.
  promise.catch(() => {});
  return { promise, cancel };
}

/**
 * Waits for the next debugger event of the target, at most `options.timeout` ms.
 * It only sees events fired after it is called: to wait for an event a command causes,
 * use `sendCommandAndWait`, which listens before sending the command.
 * @param {chrome.debugger.Debuggee} target
 * @param {string} event
 * @param {{ timeout?: number }} [options]
 */
export async function $once(target, event, options) {
  return await waitForDebuggerEvent(target, event, options).promise;
}

/**
 * Sends a CDP command and waits for an event it causes, listening before the command
 * is sent, so an event fired before the command returns is not missed
 * (e.g. `Page.navigate` then `Page.loadEventFired` on a page that loads at once).
 * @param {chrome.debugger.Debuggee} target
 * @param {string} method the command, e.g. "Page.navigate"
 * @param {object | undefined} params the command's parameters
 * @param {string} event the event to wait for, e.g. "Page.loadEventFired"
 * @param {{ timeout?: number }} [options]
 * @returns {Promise<{ result: unknown, event: { method: string, params: unknown } }>}
 */
export async function sendCommandAndWait(target, method, params, event, options) {
  const wait = waitForDebuggerEvent(target, event, options);
  let result;
  try {
    result = await chrome.debugger.sendCommand(target, method, params);
  } catch (error) {
    wait.cancel();
    throw error;
  }
  return { result, event: await wait.promise };
}
