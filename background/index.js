import {
  connectExtensionToPage,
  newConnectionHandler
} from './connectExtensionToPage.js';
import newRegistry from '../libs/newRegistry.js';
import { loadSecret } from '../libs/secretsStore.js';
import { newExtensionApi } from './newBackgroundApi.js';
import { listenPort } from '../libs/portCalls.js';

function getMethods(obj, index = {}, prefix = '') {
  for (const key in obj) {
    if (typeof obj[key] === 'object') {
      getMethods(obj[key], index, `${prefix}${key}_`);
    } else {
      index[`${prefix}${key}`] = obj[key];
    }
  }
  return index;
}
function newId(prefix = 'id-') {
  return `${prefix}${Date.now()}-${Math.random()}`;
}
const api = newExtensionApi();
newConnectionHandler({
  onConnect: (port) => {
    const [register, cleanup] = newRegistry();
    const methods = getMethods(api);
    port.start();
    
    const listeners = {};
    register(() => {
      for (let remove of Object.values(listeners)) {
        remove();
      }
      listeners = {};
    })

    register(listenPort(port, async ({ method, args }) => {
      console.log('listenPort', method, args);
      if (method === 'init') {
        return {
          methods : Object.keys(methods)
        };
      } else if (method === "done") {
        cleanup();
      } else if (method === 'addListener') {
        const [eventMethodName] = args;
        const id = newId('listener-');
        listeners[id] = methods[eventMethodName](async (...callParams) => {
          await callPort(port, {
            method: 'notifyListener',
            args: [id, ...callParams]
          });
        });
        return id;
      } else if (method === 'removeListener') {
        const [listenerId] = args;
        if (listeners[listenerId]) {
          await listeners[listenerId]();
          delete listeners[listenerId];
        }
      } else {
        const fn = methods[method];
        if (typeof fn === 'function') {
          return await fn(...args);
        } else {
          throw new Error(`Unknown method "${method}"}`);
        }
      }
    }))
    return cleanup;
  }
});

chrome.tabs.onUpdated.addListener(async function (tabId, changeInfo) {
  console.log('tabs.onUpdated', tabId, changeInfo);
  if (changeInfo.status !== 'complete') return;
  const secret = await loadSecret();
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
