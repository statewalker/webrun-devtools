import { newRegistry } from '@statewalker/utils';
import { set } from '@statewalker/getset';
import { callPort, listenPort } from '../libs/portCalls.js';
import {
  METHOD_DONE,
  METHOD_INIT,
  METHOD_ADD_LISTENER,
  METHOD_REMOVE_LISTENER,
  METHOD_NOTIFY_LISTENER,
  METHOD_RESET_CONNECTION
} from '../libs/constants.js';
import { newId } from './newId.js';

export async function initApi(port, {
  callTimeout = 1000 * 60 * 5, closeTimeout = 1000 * 5,
}) {
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
  });

  let connected;
  async function _initCall() {
    if (!connected) {
      // List of listeners to re-initialize in the background script
      const listenersList = Object.entries(listeners).map(([listenerId, { listenerMethodName }]) => {
        return [listenerId, listenerMethodName];
      });
      connected = callPort(port, {
        method: METHOD_INIT,
        args: [{
          apiKey,
          listeners: listenersList
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
    }, callTimeout);
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
          listenerMethodName: name
        };
        return await _call(METHOD_ADD_LISTENER, listenerId, name, ...args);
      }
      method = async (listener) => {
        await addListener(listener);
        return register(() => removeListener(listener));
      };
      method.addListener = addListener;
      method.removeListener = removeListener;
    } else {
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
  };

  return api;
}
