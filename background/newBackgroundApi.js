function wrapChromeApi(ns, methods) {
  return methods.reduce((api, method) => {
    if (method.startsWith('on')) {
      api[method] = (listener) => {
        chrome[ns][method].addListener(listener);
        return () => chrome[ns][method].removeListener(listener);
      }
    } else {
      api[method] = async (...args) => await chrome[ns][method](...args);
    }
    return api;
  }, {});
}

function getTabsApi() {
  // ----------------------------
  // https://developer.chrome.com/docs/extensions/reference/tabs/
  // chrome.tabs API:
  const api = wrapChromeApi("tabs", [
    // ----------------------------
    // Methods
    'captureVisibleTab',
    'connect',
    'create',
    'detectLanguage',
    'discard',
    'duplicate',
    'executeScript',
    'get',
    'getAllInWindow',
    'getCurrent',
    'getSelected',
    'getZoom',
    'getZoomSettings',
    'goBack',
    'goForward',
    'group',
    'highlight',
    'insertCSS',
    'move',
    'query',
    'reload',
    'remove',
    'removeCSS',
    'sendMessage',
    'sendRequest',
    'setZoom',
    'setZoomSettings',
    'ungroup',
    'update',

    // ----------------------------
    // Events
    'onActiveChanged',
    'onActivated',
    'onAttached',
    'onCreated',
    'onDetached',
    'onHighlightChanged',
    'onHighlighted',
    'onMoved',
    'onRemoved',
    'onReplaced',
    'onSelectionChanged',
    'onUpdated',
    'onZoomChange'
  ]);

  return Object.assign(api, {
    // ----------------------------

    async create({ url = 'about:blank' } = {}) {
      const tab = await chrome.tabs.create({ url });
      const target = { tabId: tab.id, id: tab.id };
      return target;
    },

    async remove(tabId) {
      await chrome.tabs.remove(tabId);
    },
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
    custom : getCustomApi(),
  };
}


