import { callPort, listenPort } from '../src/libs/portCalls.js';
import { set } from '../src/libs/getset.js';
import newRegistry from '../src/libs/newRegistry.js';
import { 
  METHOD_DONE, 
  METHOD_INIT, 
  METHOD_ADD_LISTENER,
  METHOD_REMOVE_LISTENER, 
  METHOD_NOTIFY_LISTENER, 

  TYPE_CONNECTION_ERROR, 
  TYPE_CONNECTION_REQUEST, 
  TYPE_CONNECTION_RESPONSE, 
  TYPE_EXTENSION_READY
} from '../src/libs/constants.js';

export default async function connectPageToExtension({
  secret, 
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
      const { data, ports } = event;
      if (data?.type === TYPE_EXTENSION_READY) {
        requestConnection();
      } else if (data?.callId === callId) {
        resolved = true;
        if (data?.type === TYPE_CONNECTION_ERROR) {
          reject(new Error(data.message));
        } else if (data.type === TYPE_CONNECTION_RESPONSE) {
          resolve(ports[0]);
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
    method: METHOD_INIT,
    args : []
  });

  const api = {};
  let listeners = {};
  register(() => {
    for (let reg of Object.values(listeners)) {
      if (typeof reg.remove === 'function') {
        reg.remove();
      }
    }
    listeners = {};
  })

  const cleanupPort = listenPort(port, async ({ method, args } = {}) => {
    if (method === METHOD_NOTIFY_LISTENER) {
      const [listenerId, ...params] = args;
      const { listener } = listeners[listenerId] || {};
      if (listener) {
        return await listener(...params);
      }
    } else {
      throw new Error(`Unknown method "${method}"}`);
    }
  });
  register(cleanupPort);

  for (let name of methods) {
    const path = name.split('_');
    let method;
    if (name.match(/_on[A-Z]/)) {
      method = async (listener) => {
        const listenerId = await callPort(port, {
          method : METHOD_ADD_LISTENER,
          args : [name],
        })
        const remove = async () => {
          delete listeners[listenerId];
          await callPort(port, {
            method : METHOD_REMOVE_LISTENER,
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
  // Let know to the extension that this connection and associated resources
  // should be cleaned up
  register(() => callPort(port, {
    method : METHOD_DONE,
    args : []
  }));
  register(() => setTimeout(() => port.close(), closeTimeout));

  api.close = () => {
    cleanup();
  }
  return api;

}
