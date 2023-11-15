import * as Comlink from './comlink.js';
import {
  connectExtensionToPage,
  newConnectionHandler
} from './connectExtensionToPage.js';
import newRegistry from './newRegistry.js';

function newTabsListeners() {
  const tabs = {};
  const [register, cleanup] = newRegistry();
  return {
    on(tabId, method, listener) {
      const methods = (tabs[tabId] = tabs[tabId] || {});
      const list = (methods[method] = methods[method] || []);
      list.push(listener);
      return register(() => {
        const index = list.indexOf(listener);
        if (index !== -1) list.splice(index, 1);
        if (list.length === 0) {
          delete methods[method];
          if (Object.keys(methods).length === 0) {
            delete tabs[tabId];
          }
        }
      });
    },
    once(tabId, method, listener) {
      const cleanup = this.on(tabId, method, (...args) => {
        cleanup();
        listener(...args);
      });
      return cleanup;
    },
    notify(tabId, method, params) {
      const methods = tabs[tabId];
      if (!methods) return;
      const list = methods[method];
      if (!list) return;
      list.forEach((listener) => listener(params));
    },
    close: cleanup
  };
}

function newApi() {
  const [register, cleanup] = newRegistry();
  const listeners = newTabsListeners();
  register(listeners.close);

  function handler(source, method, params) {
    listeners.notify(source.tabId, method, params);
  }
  chrome.debugger.onEvent.addListener(handler);
  register(() => chrome.debugger.onEvent.removeListener(handler));

  return {
    // ----------------------------

    async tabs_create({ url = 'about:blank' } = {}) {
      const tab = await chrome.tabs.create({ url });
      const target = { tabId: tab.id, id: tab.id };
      return target;
    },

    async tabs_remove(tabId) {
      await chrome.tabs.remove(tabId);
    },

    // ----------------------------

    async debugger_attach(target, version = '1.3') {
      await chrome.debugger.attach(target, version);
    },

    async debugger_detach(target) {
      await chrome.debugger.detach(target);
    },

    async debugger_$once(target, event) {
      return new Promise((resolve) => {
        listeners.once(target.tabId, event, resolve);
      });
    },

    async debugger_sendCommand(target, method, commandParams) {
      return await chrome.debugger.sendCommand(target, method, commandParams);
    },

    async debugger_getTargets() {
      return await chrome.debugger.getTargets();
    },

    // ----------------------------

    async custom_injectScript(
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

    destroy() {
      cleanup();
    }
  };
}

const api = newApi();
newConnectionHandler({
  onConnect: (port) => {
    const [register, cleanup] = newRegistry();
    const notify = Comlink.wrap(port);
    register(() => notify[Comlink.releaseProxy]());
    const newHandler = (messageType) => {
      return (...args) => notify(messageType, ...args);
    };

    const onEvent = newHandler('onEvent');
    chrome.debugger.onEvent.addListener(onEvent);
    register(() => chrome.debugger.onEvent.removeListener(onEvent));
    const methods = Object.keys(api).filter((method) => method !== 'destroy');
    notify('onConnect', { methods });
    const exposedApi = methods.reduce((obj, method) => {
      obj[method] = (...args) => api[method](...args);
      return obj;
    }, {});
    Comlink.expose(exposedApi, port);
    return cleanup;
  }
});

chrome.tabs.onUpdated.addListener(async function (tabId, changeInfo) {
  console.log('tabs.onUpdated', tabId, changeInfo);
  if (changeInfo.status !== 'complete') return;

  const secret = 'Hello, world!';
  const cleanup = connectExtensionToPage({
    tabId,
    secret
  });
});

// chrome.debugger.onEvent.addListener(function (source, method, params) {
//   if (method === 'Network.responseReceived') {
//     console.log('Response received:', params.response);
//     // Perform your desired action with the response data
//   }
// });
