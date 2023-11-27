import { wrapChromeApi } from "../wrapChromeApi.js";
import { $once } from "./$once.js";

/**
 * Returns the debugger API with additional methods.
 * @returns {Object} The debugger API object.
 */
export function getDebuggerApi() {
  const api = wrapChromeApi("debugger", [
    "attach",
    "detach",
    "sendCommand",
    "getTargets",
    "onDetach",
    "onEvent",
  ]);
  return Object.assign(api, {
    $once,
  });
}
