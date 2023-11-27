import { getCustomApi } from "./custom/index.js";
import { getDebuggerApi } from "./debugger/index.js";
import { getTabsApi } from "./tabs/index.js";
import { getWindowApi } from "./windows/index.js";

export function newExtensionApi() {
  return  {
    tabs : getTabsApi(),
    debugger : getDebuggerApi(),
    windows : getWindowApi(),
    custom : getCustomApi(),
  };
}


