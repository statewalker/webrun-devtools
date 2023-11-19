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

function newId(prefix = 'id-') {
  return `${prefix}${Date.now()}-${String(Math.random()).substring(2)}`;
}

async function openPortToExtension({
  secret, 
  timeout = 1000 * 5
}) {
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
  return port;
}


export default async function connectPageToExtension({
  secret, 
  timeout = 1000 * 5,
  callTimeout = 1000 * 60 * 5,
  closeTimeout = 1000 * 5,
}) {
  const port = await openPortToExtension({ secret, timeout });

  const [register, cleanup] = newRegistry();

  const { methods } = await callPort(port, {
    method: METHOD_INIT,
    args : []
  });

  const api = {};
  let listeners = {};
  register(() => {
    for (let { listener, removeListener } of Object.values(listeners)) {
      if (typeof removeListener === 'function') {
        removeListener(listener);
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
    const path = name.split('.');
    let method;
    if (name.match(/\.on[A-Z]/)) {
      async function removeListener(listener) {
        const listenerId = listener.__id;
        delete listener.__id;
        delete listeners[listenerId];
        return await callPort(port, {
          method : METHOD_REMOVE_LISTENER,
          args : [listenerId, name],
        });  
      }
      async function addListener(listener, ...args) {
        const listenerId = listener.__id = newId('listener-');
        listeners[listenerId] = {
          listener,
          removeListener
        };
        return await callPort(port, {
          method : METHOD_ADD_LISTENER,
          args : [listenerId, name, ...args],
        });
      }
      method = async (listener) => {
        await addListener(listener);
        return register(() => removeListener(listener));
      }
      method.addListener = addListener;
      method.removeListener = removeListener;
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
    // Let know to the extension that this connection and associated resources
    // should be cleaned up
    await callPort(port, {
      method : METHOD_DONE,
      args : []
    });
    setTimeout(() => port.close(), closeTimeout);
  }
  
  return api;

}
