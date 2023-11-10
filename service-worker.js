import * as Comlink from './comlink.js';
import { establishExtensionToPageConnection } from './establishExtensionToPageConnection.js';

// chrome.action.onClicked.addListener(async (tab) => {});

chrome.tabs.onUpdated.addListener(async function (tabId, changeInfo, tab) {
  if (changeInfo.status !== 'complete') return;
  const port = await establishExtensionToPageConnection(tab.id);
  if (!port) return;
  const parentTabId = tab.id;
  const notify = Comlink.wrap(port);
  const index = {};
  const api = {
    async open(url = 'about:blank', version = '1.3') {
      // await notify('newTarget', url);
      const tab = await chrome.tabs.create({
        url
      });
      const target = { tabId: tab.id };
      const targetInfo = (index[target.tabId] = { listeners: {} });
      await chrome.debugger.attach(target, version);
      targetInfo.handler = (source, method, params) => {
        if (source.tabId !== target.tabId) return;
        notify(target, method, params);
        const list = targetInfo.listeners[method] || [];
        delete targetInfo.listeners[method];
        list.forEach(({ resolve }) => resolve({ method, params }));
      };
      chrome.debugger.onEvent.addListener(targetInfo.handler);
      // await chrome.tabs.update(parentTabId, {
      //   active: true,
      //   highlighted: true
      // });
      return target;
    },

    async until(target, event) {
      return new Promise((resolve, reject) => {
        const targetInfo = index[target.tabId];
        if (!targetInfo) {
          reject({ message: 'Target not found' });
        } else {
          const list = (targetInfo.listeners[event] =
            targetInfo.listeners[event] || []);
          list.push({
            resolve,
            reject
          });
        }
      });
    },

    async send(target, method, commandParams) {
      // await notify('sendCommand', target, method, commandParams);
      return await chrome.debugger.sendCommand(target, method, commandParams);
    },

    async close(target) {
      const targetInfo = index[target.tabId];
      delete index[target.tabId];
      if (targetInfo) {
        for (const [method, list] of Object.entries(targetInfo.listeners)) {
          list.forEach(({ reject }) =>
            reject({
              type: 'error',
              method,
              error: 'Session closed'
            })
          );
        }
        chrome.debugger.onEvent.removeListener(targetInfo.handler);
        await chrome.debugger.detach(target);
        await chrome.tabs.remove(target.tabId);
      }
      await chrome.tabs.update(parentTabId, {
        active: true,
        highlighted: true
      });
    }

    // async newSession(url = 'about:blank', version = '1.3') {
    //   await notify('newTarget', url);
    //   const tab = await chrome.tabs.create({
    //     url
    //   });
    //   await chrome.debugger.attach({ tabId: tab.id }, version);
    //   return { tabId: tab.id };
    // },
    // async attach(target, version = '1.3') {
    //   await notify('attach', target, version);
    //   return await chrome.debugger.attach(target, version);
    // },
    // async detach(target) {
    //   await notify('detach', target);
    //   return await chrome.debugger.detach(target);
    // },
    // async getTargets() {
    //   await notify('getTargets');
    //   return await chrome.debugger.getTargets();
    // },
    // async sendCommand(target, method, commandParams) {
    //   await notify('sendCommand', target, method, commandParams);
    //   return await chrome.debugger.sendCommand(target, method, commandParams);
    // }
  };
  Comlink.expose(api, port);
});

// chrome.debugger.onEvent.addListener(function (source, method, params) {
//   if (method === 'Network.responseReceived') {
//     console.log('Response received:', params.response);
//     // Perform your desired action with the response data
//   }
// });
