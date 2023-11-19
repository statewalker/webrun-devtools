import { newRegistry } from '@statewalker/utils';

export function newTabsListeners() {
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
