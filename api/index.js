// import * as Comlink from 'https://unpkg.com/comlink/dist/esm/comlink.mjs';
import * as Comlink from '../libs/comlink.js';

const TYPE_EXTENSION_READY = 'extension-ready';
const TYPE_CONNECTION_REQUEST = 'connection-request';
const TYPE_CONNECTION_RESPONSE = 'connection-response';
const TYPE_CONNECTION_ERROR = 'connection-error';

export default async function connectPageToExtension({
  secret, 
  onEvent = () => {},
  timeout = 1000 * 5
}) {
  let timerId, onMessage;
  const promise = new Promise((resolve, reject) => {
    timerId = setTimeout(() => reject(new Error('Connection timeout. Please check that the extension is')), timeout);
    let resolved = false;
    const callId = `call-${Date.now()}-${Math.random()}`;
    function requestConnection() {
      if (resolved) return;
      window.postMessage({ type: TYPE_CONNECTION_REQUEST, secret, callId }, '*');
    }  
    onMessage = (event) => {
      if (event.source !== window) return;
      if (event.data.type === TYPE_EXTENSION_READY) {
        requestConnection();
      } else if (event.data.callId === callId) {
        if (event.data.type === TYPE_CONNECTION_ERROR) {
          window.removeEventListener('message', onMessage);
          reject(new Error(event.data.message));
          resolved = true;
        } else if (event.data.type === TYPE_CONNECTION_RESPONSE) {
          window.removeEventListener('message', onMessage);
          resolve(event.ports[0]);
          resolved = true;
        }
      }
    }
    window.addEventListener('message', onMessage);
    requestConnection();
  })
  promise.finally(() => clearTimeout(timerId));
  promise.finally(() => onMessage && window.removeEventListener('message', onMessage));

  const port = await promise;;  
  const { methods } = await new Promise((resolve) => {
    Comlink.expose((messageType, ...args) => {
      if (messageType === 'onConnect') {
        resolve(args[0]);
      }
      if (messageType === 'onEvent') {
        onEvent(messageType, ...args);
      }
    }, port);
  });
  const connector = Comlink.wrap(port);

  const api = methods.reduce((api, method) => {
    const [ns, name] = method.split('_');
    const obj = api[ns] || (api[ns] = {});
    obj[name] = async (...args) => await connector[method](...args);
    return api;
  }, {});
  return api;
}
