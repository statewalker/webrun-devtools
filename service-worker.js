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
    async open(url = 'about:blank', version = '1.3') {
      const tab = await chrome.tabs.create({ url });
      const target = { tabId: tab.id };
      await chrome.debugger.attach(target, version);
      return target;
    },

    async until(target, event) {
      return new Promise((resolve) => {
        listeners.once(target.tabId, event, resolve);
      });
    },

    async send(target, method, commandParams) {
      return await chrome.debugger.sendCommand(target, method, commandParams);
    },

    async close(target) {
      await chrome.debugger.detach(target);
      await chrome.tabs.remove(target.tabId);
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
    Comlink.expose(
      {
        open: api.open,
        until: api.until,
        send: api.send,
        close: api.close
      },
      port
    );
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
