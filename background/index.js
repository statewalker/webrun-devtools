import * as Comlink from '../libs/comlink.js';
import {
  connectExtensionToPage,
  newConnectionHandler
} from './connectExtensionToPage.js';
import newRegistry from '../libs/newRegistry.js';
import { loadSecret } from '../libs/secretsStore.js';
import { newExtensionApi } from './newBackgroundApi.js';

const api = newExtensionApi();
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
