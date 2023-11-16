import { callPort, listenPort } from '../libs/portCalls.js';
import { set } from '../libs/getset.js';

const TYPE_EXTENSION_READY = 'extension-ready';
const TYPE_CONNECTION_REQUEST = 'connection-request';
const TYPE_CONNECTION_RESPONSE = 'connection-response';
const TYPE_CONNECTION_ERROR = 'connection-error';

export default async function connectPageToExtension({
  secret, 
  onEvent = () => {},
  timeout = 1000 * 5,
  callTimeout = 1000 * 60 * 5
}) {
  function newId(prefix = 'id-') {
    return `call-${Date.now()}-${Math.random()}`;
  }
  let timerId, onMessage;
  const promise = new Promise((resolve, reject) => {
    timerId = setTimeout(() => reject(new Error('Connection timeout. Please check that the debugger extension is active')), timeout);
    let resolved = false;
    const callId = newId('call-');
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

  const port = await promise;
  port.start();
  const methods = await callPort(port, {
    method: 'getMethods',
    args : []
  });

  const api = {};
  for (let method of methods) {
    const path = method.split('_');
    set(api, path, async (...args) => await callPort(port, {
      method,
      args
    }, callTimeout));
  }
  return api;

}
