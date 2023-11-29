import { wrapChromeApi } from "../wrapChromeApi.js";

/**
 * Retrieves the tabs API.
 * @returns {Object} The tabs API object.
 */
export function getTabsApi() {
  // ----------------------------
  // https://developer.chrome.com/docs/extensions/reference/tabs/
  // chrome.tabs API:
  const api = wrapChromeApi("tabs", [
    // ----------------------------
    "captureVisibleTab",
    // 'connect', // can not return ports
    "create",
    "detectLanguage",
    "discard",
    "duplicate",
    // 'executeScript', // deprecated
    "get",
    // 'getAllInWindow', // deprecated
    "getCurrent",
    // 'getSelected', // deprecated
    "getZoom",
    "getZoomSettings",
    "goBack",
    "goForward",
    "group",
    "highlight",
    // 'insertCSS', // deprecated
    "move",
    "query",
    "reload",
    "remove",
    // 'removeCSS', // deprecated
    "sendMessage",
    // 'sendRequest', // deprecated
    "setZoom",
    "setZoomSettings",
    "ungroup",
    "update",

    // ----------------------------
    // Events
    // 'onActiveChanged', // deprecated
    "onActivated",
    "onAttached",
    "onCreated",
    "onDetached",
    // 'onHighlightChanged', // deprecated
    "onHighlighted",
    "onMoved",
    "onRemoved",
    "onReplaced",
    // 'onSelectionChanged', // deprecated
    "onUpdated",
    "onZoomChange",
  ]);

  return Object.assign(api, {
    // ----------------------------
    // async create({ url = 'about:blank' } = {}) {
    //   const tab = await chrome.tabs.create({ url });
    //   const target = { tabId: tab.id, id: tab.id };
    //   return target;
    // },
  });
}
