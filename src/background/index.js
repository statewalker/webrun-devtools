import {
  connectExtensionToPage,
  newConnectionHandler
} from './connectExtensionToPage.js';
import newRegistry from '../libs/newRegistry.js';
import { loadSecret } from '../libs/secretsStore.js';
import { newExtensionApi } from './newBackgroundApi.js';
import { callPort, listenPort } from '../libs/portCalls.js';
import { 
  METHOD_DONE, 
  METHOD_INIT, 
  METHOD_ADD_LISTENER,
  METHOD_REMOVE_LISTENER, 
  METHOD_NOTIFY_LISTENER, 
} from '../libs/constants.js';


function getMethods(obj, index = {}, prefix = '') {
  for (const key in obj) {
    if (typeof obj[key] === 'object') {
      getMethods(obj[key], index, `${prefix}${key}.`);
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

    let listeners = {};
    register(() => {
      for (let remove of Object.values(listeners)) {
        remove();
      }
      listeners = {};
    })

    register(listenPort(port, async (data) => {
      if (!data) {
        throw new Error("No data");
      }
      const { method, args } = data;
      if (method === METHOD_INIT) {
        return {
          methods : Object.keys(methods)
        };
      } else if (method === METHOD_DONE) {
        cleanup();
      } else if (method === METHOD_ADD_LISTENER) {
        const [listenerId, eventMethodName] = args;
        const fn = methods[eventMethodName];
        if (typeof fn === 'function') {
          listeners[listenerId] = fn(async (...callParams) => {
            await callPort(port, {
              method: METHOD_NOTIFY_LISTENER,
              args: [listenerId, ...callParams]
            });
          });
          return listenerId;
        } else {
          throw new Error(`Unknown event listener. Name: "${eventMethodName}"; ListenerId: "${listenerId}".`);
        }
      } else if (method === METHOD_REMOVE_LISTENER) {
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
  if (changeInfo.status !== 'complete') return;
  const secret = await loadSecret();
  const cleanup = connectExtensionToPage({
    tabId,
    secret
  });
});
