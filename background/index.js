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

const api = newExtensionApi();
newConnectionHandler({
  onConnect: (port) => {
    const [register, cleanup] = newRegistry();
    const methods = getMethods(api);
    port.start();
    register(listenPort(port, async ({ method, args }) => {
      console.log('listenPort', method, args);
      if (method === 'getMethods') {
        return Object.keys(methods);
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
