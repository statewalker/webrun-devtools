import { callPort, listenPort } from '../libs/portCalls.js';
import { set } from '../libs/getset.js';
import newRegistry from '../libs/newRegistry.js';

const TYPE_EXTENSION_READY = 'extension-ready';
const TYPE_CONNECTION_REQUEST = 'connection-request';
const TYPE_CONNECTION_RESPONSE = 'connection-response';
const TYPE_CONNECTION_ERROR = 'connection-error';

export default async function connectPageToExtension({
  secret, 
  onEvent = () => {},
  timeout = 1000 * 5,
  callTimeout = 1000 * 60 * 5,
  closeTimeout = 1000 * 5,
}) {
  function newId(prefix = 'id-') {
    return `${prefix}${Date.now()}-${Math.random()}`;
  }
  let timerId, onMessage;
  const promise = new Promise((resolve, reject) => {
    timerId = setTimeout(() => 
      reject(
        new Error('Connection timeout. Please check that the debugger extension is active.')
      ),
      timeout
    );
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

  const [register, cleanup] = newRegistry();

  const { methods } = await callPort(port, {
    method: 'init',
    args : []
  });

  const api = {};
  let listeners = {};
  register(() => {
    for (let { remove } of Object.values(listeners)) {
      remove();
    }
    listeners = {};
  })
  register(listenPort(port, async ({ method, args }) => {
    if (method === "notifyListener") {
      const [listenerId, ...params] = args;
      const { listener } = listeners[listenerId] || {};
      if (listener) {
        return await listener(...params);
      }
    } else {
      throw new Error(`Unknown method "${method}"}`);
    }
  }));

  for (let name of methods) {
    const path = name.split('_');
    let method;
    if (name.match(/_on[A-Z]/)) {
      method = async (...args) => {
        const listenerId = await callPort(port, {
          method : "addListener",
          args : [name, ...args],
        })
        const remove = async () => {
          delete listeners[listenerId];
          await callPort(port, {
            method : "removeListener",
            args : [listenerId, name],
          })
        }
        listeners[listenerId] = {
          listener,
          remove
        };
        return remove;
      }
    } else{
      method = async (...args) => await callPort(port, {
        method : name,
        args
      }, callTimeout);
    }
    set(api, path, method);
  }
  api.close = async () => {
   cleanup(); 
    await callPort(port, {
      method : "done",
      args : []
    });
    setTimeout(() => port.close(), closeTimeout)
  }
  // register(() => port.close());
  return api;

}
