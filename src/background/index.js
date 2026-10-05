import { newRegistry } from "@statewalker/utils";
import { callPort, listenPort } from "@statewalker/webrun-ports";
import { loadApiKey } from "../libs/apiKeysStore.js";
import {
  METHOD_ADD_LISTENER,
  METHOD_DONE,
  METHOD_INIT,
  METHOD_NOTIFY_LISTENER,
  METHOD_REMOVE_LISTENER,
} from "../libs/constants.js";
import { newExtensionApi } from "./api/index.js";
import { newConnectionHandler } from "./connectExtensionToPage.js";

function getMethods(obj, index = {}, prefix = "") {
  for (const key in obj) {
    if (typeof obj[key] === "object") {
      getMethods(obj[key], index, `${prefix}${key}.`);
    } else {
      index[`${prefix}${key}`] = obj[key];
    }
  }
  return index;
}

async function validateApiKey(key) {
  const apiKey = await loadApiKey();
  return key === apiKey;
}

newConnectionHandler({
  onConnect: (port) => {
    const [register, cleanup] = newRegistry();
    port.start();
    const api = newExtensionApi({ port });
    const methods = getMethods(api);

    async function initializeConnection(apiKey, listeners) {
      if (!(await validateApiKey(apiKey))) {
        const message = "The page is not authorized to establish connection with this extension.";
        throw new Error(message);
      } else {
        for (const [listenerId, eventMethodName] of listeners) {
          await addListener(listenerId, eventMethodName);
        }
        initialized = true;
      }
      return {
        methods: Object.keys(methods),
      };
    }

    async function addListener(listenerId, eventMethodName) {
      const fn = methods[eventMethodName];
      if (typeof fn === "function") {
        listeners[listenerId] = fn(async (...callParams) => {
          await callPort(port, {
            method: METHOD_NOTIFY_LISTENER,
            args: [listenerId, ...callParams],
          });
        });
        return listenerId;
      } else {
        throw new Error(
          `Unknown event listener. Name: "${eventMethodName}"; ListenerId: "${listenerId}".`,
        );
      }
    }

    async function removeListener(listenerId) {
      if (listeners[listenerId]) {
        await listeners[listenerId]();
        delete listeners[listenerId];
      }
    }

    let listeners = {};
    let initialized = false;
    register(() => {
      for (const remove of Object.values(listeners)) {
        remove();
      }
      listeners = {};
    });

    register(
      listenPort(port, async (data) => {
        if (!data) {
          throw new Error("No data");
        }
        const { method, args } = data;
        if (method === METHOD_INIT) {
          const { apiKey, listeners = [] } = args[0] || {};
          return await initializeConnection(apiKey, listeners);
        }
        if (!initialized) {
          throw new Error(`The API was not initialized. Method: "${method}"`);
        }
        if (method === METHOD_DONE) {
          cleanup();
        } else if (method === METHOD_ADD_LISTENER) {
          const [listenerId, eventMethodName] = args;
          return await addListener(listenerId, eventMethodName);
        } else if (method === METHOD_REMOVE_LISTENER) {
          const [listenerId] = args;
          return await removeListener(listenerId);
        } else {
          const fn = methods[method];
          if (typeof fn === "function") {
            return await fn(...args);
          } else {
            throw new Error(`Unknown method "${method}"}`);
          }
        }
      }),
    );
    return cleanup;
  },
});

// chrome.tabs.onUpdated.addListener(async function (tabId, changeInfo) {
//   console.log('[chrome.tabs.onUpdated]', changeInfo)
//   if (changeInfo.status !== 'complete') return;
//   const apiKey = await loadApiKey();
//   const cleanup = connectExtensionToPage({
//     tabId,
//     apiKey
//   });
// });
