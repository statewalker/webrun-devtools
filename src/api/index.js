import { newRegistry } from '@statewalker/utils';
export { newRegistry };

import { set } from '@statewalker/getset';
import { callPort, listenPort } from '../libs/portCalls.js';
import { 
  METHOD_DONE, 
  METHOD_INIT, 
  METHOD_ADD_LISTENER,
  METHOD_REMOVE_LISTENER, 
  METHOD_NOTIFY_LISTENER, 
  METHOD_RESET_CONNECTION,

  TYPE_CONNECTION_ERROR, 
  TYPE_CONNECTION_REQUEST, 
  TYPE_CONNECTION_RESPONSE, 
  TYPE_EXTENSION_READY
} from '../libs/constants.js';

function newId(prefix = 'id-') {
  return `${prefix}${Date.now()}-${String(Math.random()).substring(2)}`;
}

async function openPortToExtension({
  apiKey, 
  timeout = 1000 * 5
}) {
  await new Promise((resolve) => {
    const finish = () => setTimeout(resolve, 10);
    if (document.readyState === 'complete') {
      finish();
    } else {
      document.addEventListener('DOMContentLoaded', finish);
    }
  })
  console.log('[openPortToExtension]', { apiKey, timeout })
  let timerId, onMessage;
  const promise = new Promise((resolve, reject) => {
    timerId = setTimeout(() => 
      reject(
        new Error('Connection timeout. Please check that the WebRun DevTools browser extension is active.')
      ),
      timeout
    );
    let resolved = false;
    const callId = newId('call-');
    function requestConnection() {
      if (resolved) return;
      window.postMessage({ type: TYPE_CONNECTION_REQUEST, apiKey, callId }, '*');
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
  apiKey, 
  timeout = 1000 * 5,
  callTimeout = 1000 * 60 * 5,
  closeTimeout = 1000 * 5,
}) {
  const port = await openPortToExtension({ apiKey, timeout });

  const [register, cleanup] = newRegistry();

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

  let connected;
  async function _initCall() {
    if (!connected) {
      // List of listeners to re-initialize in the background script
      const listenersList = Object.entries(listeners).map(([listenerId, { listenerMethodName }]) => {
        return [listenerId, listenerMethodName];
      });
      connected = callPort(port, {
        method : METHOD_INIT,
        args : [{
          apiKey,
          listeners : listenersList
        }]
      }, callTimeout);
    }
    return connected;
  }

  async function _call(method, ...args) {
    await _initCall();
    return await callPort(port, {
      method,
      args
    }, callTimeout)
  }

  const cleanupPort = listenPort(port, async ({ method, args } = {}) => {
    if (method === METHOD_NOTIFY_LISTENER) {
      const [listenerId, ...params] = args;
      const { listener } = listeners[listenerId] || {};
      if (listener) {
        return await listener(...params);
      }
    } else if (method === METHOD_RESET_CONNECTION) {
      // This method is called by the injected script when the connection
      // with the background is lost.
      connected = null;
      await _initCall();
    } else {
      throw new Error(`Unknown method "${method}"}`);
    }
  });
  register(cleanupPort);

  const { methods } = await _initCall();
  for (let name of methods) {
    const path = name.split('.');
    let method;
    if (name.match(/\.on[A-Z]/)) {
      async function removeListener(listener) {
        const listenerId = listener.__id;
        delete listener.__id;
        delete listeners[listenerId];
        return await _call(METHOD_REMOVE_LISTENER, listenerId, name);  
      }
      async function addListener(listener, ...args) {
        const listenerId = listener.__id = newId('listener-');
        listeners[listenerId] = {
          listener,
          removeListener,
          listenerMethodName : name
        };
        return await _call(METHOD_ADD_LISTENER, listenerId, name, ...args);
      }
      method = async (listener) => {
        await addListener(listener);
        return register(() => removeListener(listener));
      }
      method.addListener = addListener;
      method.removeListener = removeListener;
    } else{
      method = async (...args) => await _call(name, ...args);
    }
    set(api, path, method);
  }

  api.close = async () => {
    cleanup();
    // Let know to the extension that this connection and associated resources
    // should be cleaned up
    await _call(METHOD_DONE);
    setTimeout(() => port.close(), closeTimeout);
  }
  
  return api;
}
