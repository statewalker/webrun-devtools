function wrapChromeApi(ns, methods) {
  return methods.reduce((api, method) => {
    if (method.startsWith('on')) {
      api[method] = (listener, ...args) => {
        const handler = (...params) => { listener(...params); }
        chrome[ns][method].addListener(handler, ...args);
        return () => chrome[ns][method].removeListener(handler);
      }
    } else {
      api[method] = async (...args) => await chrome[ns][method](...args);
    }
    return api;
  }, {});
}

function getWindowApi() {
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

function getTabsApi() {
  // ----------------------------
  // https://developer.chrome.com/docs/extensions/reference/tabs/
  // chrome.tabs API:
  const api = wrapChromeApi("tabs", [
    // ----------------------------

    'captureVisibleTab',
    // 'connect', // can not return ports
    'create',
    'detectLanguage',
    'discard',
    'duplicate',
    // 'executeScript', // deprecated
    'get',
    // 'getAllInWindow', // deprecated
    'getCurrent',
    // 'getSelected', // deprecated
    'getZoom',
    'getZoomSettings',
    'goBack',
    'goForward',
    'group',
    'highlight',
    // 'insertCSS', // deprecated
    'move',
    'query',
    'reload',
    'remove',
    // 'removeCSS', // deprecated
    'sendMessage',
    // 'sendRequest', // deprecated
    'setZoom',
    'setZoomSettings',
    'ungroup',
    'update',

    // ----------------------------
    // Events
    // 'onActiveChanged', // deprecated
    'onActivated',
    'onAttached',
    'onCreated',
    'onDetached',
    // 'onHighlightChanged', // deprecated
    'onHighlighted',
    'onMoved',
    'onRemoved',
    'onReplaced',
    // 'onSelectionChanged', // deprecated
    'onUpdated',
    'onZoomChange'
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

function getDebuggerApi() {
  const api = wrapChromeApi("debugger", [
    "attach", 
    "detach", 
    "sendCommand", 
    "getTargets",
    "onDetach",
    "onEvent",
  ]);
  return Object.assign(api, {
    async $once(target, event) {
      let handler;
      const promise = new Promise((resolve, reject) => {
        chrome.debugger.onEvent.addListener(handler = (source, method, params) => {
          if (source.tabId !== target.tabId) return;
          if (method !== event) return;
          resolve({
            method,
            params
          });
        })
      });
      promise.finally(() => chrome.debugger.onEvent.removeListener(handler));
      return promise;
    },
  });
}


function getCustomApi() {
  return {

    async injectScript(
      target,
      { func, args = [], type = 'module' } = {}
    ) {
      const [{ result, documentId, frameId }] =
        await chrome.scripting.executeScript({
          target,
          injectImmediately: true,
          world: 'MAIN',
          args: [
            {
              func,
              args,
              type
            }
          ],
          // A standalone script without any dependencies.
          // So we can not use imported / global statements here.
          func: async function injectedFunction({ func, args }) {
            try {
              const code = `return (${func})`;
              const f = new Function([], code)();
              const result = await f(...args);
              return {
                status: 'ok',
                result
              };
            } catch (error) {
              const stack = error.stack.split('\n');
              let positions;
              for (const line of stack) {
                line.replace(
                  /\(eval .* \(:(\d+):(\d+)\)[^\r\n]*:(\d+):(\d+)\)/gim,
                  (_, _startLine, _startPos, _line, _pos) => {
                    positions = [_startLine, _startPos, _line, _pos].map(
                      (d) => +d
                    );
                  }
                );
                if (positions) break;
              }
              positions = positions || [0, 0, 0, 0];
              const line = positions[2] - positions[0];
              const column = positions[3];
              return {
                status: 'error',
                error: {
                  message: error.message,
                  stack,
                  line,
                  column
                }
              };
            }
          }
        });
      return { ...result, documentId, frameId };
    },
  }
}

export function newExtensionApi() {
  return  {
    tabs : getTabsApi(),
    debugger : getDebuggerApi(),
    windows : getWindowApi(),
    custom : getCustomApi(),
  };
}


