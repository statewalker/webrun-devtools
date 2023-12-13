import { getCustomApi } from "./custom/index.js";
import { getDebuggerApi } from "./debugger/index.js";
import { getTabsApi } from "./tabs/index.js";
import { getWindowApi } from "./windows/index.js";
import { getHttpApi } from "./http/index.js";

export function newExtensionApi(options) {
  return {
    tabs: getTabsApi(options),
    debugger: getDebuggerApi(options),
    windows: getWindowApi(options),
    custom: getCustomApi(options),
    http: getHttpApi(options),
  };
}

