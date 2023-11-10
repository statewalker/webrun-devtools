import * as Comlink from './comlink.js';
import { establishExtensionToPageConnection } from './establishExtensionToPageConnection.js';

// chrome.action.onClicked.addListener(async (tab) => {});

chrome.tabs.onUpdated.addListener(async function (tabId, changeInfo, tab) {
  if (changeInfo.status !== 'complete') return;
  const port = await establishExtensionToPageConnection(tab.id);
  if (!port) return;
  const parentTabId = tab.id;
  const notify = Comlink.wrap(port);
  let target,
    listener,
    eventListeners = {};
  function checkInitialized() {
    if (!target) throw new Error('Session is not initialized');
  }
  const api = {
    async open(url = 'about:blank', version = '1.3') {
      // await notify('newTarget', url);
      const tab = await chrome.tabs.create({
        url
      });
      target = { tabId: tab.id };
      await chrome.debugger.attach(target, version);
      listener = (source, method, params) => {
        if (source.tabId !== target.tabId) return;
        notify(method, params);
        const listeners = eventListeners[method] || [];
        delete eventListeners[method];
        listeners.forEach(({ resolve }) => resolve({ method, params }));
      };
      chrome.debugger.onEvent.addListener(listener);
      // await chrome.tabs.update(parentTabId, {
      //   active: true,
      //   highlighted: true
      // });
      return target;
    },

    async until(event) {
      return new Promise((resolve, reject) => {
        const listeners = (eventListeners[event] = eventListeners[event] || []);
        listeners.push({
          resolve,
          reject
        });
      });
    },

    async send(method, commandParams) {
      checkInitialized();
      // await notify('sendCommand', target, method, commandParams);
      return await chrome.debugger.sendCommand(target, method, commandParams);
    },

    async close() {
      checkInitialized();
      for (const [method, listeners] of Object.entries(eventListeners)) {
        listeners.forEach(({ reject }) =>
          reject({
            type: 'error',
            method,
            error: 'Session closed'
          })
        );
      }
      chrome.debugger.onEvent.removeListener(listener);
      await chrome.debugger.detach(target);
      await chrome.tabs.remove(target.tabId);
      target = null;
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
