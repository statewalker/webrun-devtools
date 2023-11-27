import { wrapChromeApi } from "../wrapChromeApi.js";

export function getWindowApi() {
  return wrapChromeApi("windows", [
    "create",
    "get",
    "getAll",
    "getCurrent",
    "getLastFocused",
    "remove",
    "update",

    "onBoundsChanged",
    "onCreated",
    "onFocusChanged",
    "onRemoved",
  ]);
}
