import { checkCommandResponse } from "./commandsInfo.js";

export async function newDebuggerApi(
  port,
  { inBrowser = false, hasResponse = checkCommandResponse(inBrowser) } = {}
) {
  let idCounter = 1;
  async function call(method, params = {}, ...options) {
    const callId = idCounter++;
    const promise = new Promise((resolve, reject) => {
      try {
        const withResponse = hasResponse(method);
        if (withResponse) {
          port.addEventListener("message", function onMessage({ data }) {
            if (callId !== data.id) return;
            port.removeEventListener("message", onMessage);
            const { result, error } = data;
            if (error) reject(error);
            else resolve(result);
          });
        }
        port.postMessage(
          Object.assign(
            {
              id: callId,
              method,
              params,
            },
            ...options
          )
        );
        if (!withResponse) {
          resolve();
        }
      } catch (e) {
        reject(e);
      }
    });
    console.log("[>>>]", { callId, method, params });
    promise
      .then((result) =>
        console.log("[<<<]", { callId, method, params, result })
      )
      .catch((error) =>
        console.log("[<<<]", { callId, method, params, error })
      );
    return promise;
  }
  const targetsToSessions = {};
  const sessionsToTargets = {};

  let onEventListeners = [];
  let onDetachListeners = [];

  async function sendCommand(target, method, params = {}) {
    const { targetId } = target;
    const sessionId = targetsToSessions[targetId];
    // console.log("[sendCommand]", { targetId, sessionId, method, params });
    // if (!sessionId) {
    //   throw new Error(`Session is not defined for the target "${targetId}"`);
    // }
    return await call(method, params, { sessionId });
  }

  async function getTargets() {
    const response = await call("Target.getTargets");
    return response.targetInfos;
  }

  async function attach(target) {
    const { targetId } = target;
    const { sessionId } = await call("Target.attachToTarget", {
      targetId,
      flatten: true,
    });
    targetsToSessions[targetId] = sessionId;
    sessionsToTargets[sessionId] = targetId;
  }

  async function detach(target) {
    const { targetId } = target;
    const sessionId = targetsToSessions[targetId];
    delete targetsToSessions[targetId];
    delete sessionsToTargets[sessionId];
    await call("Target.detachFromTarget", {
      // targetId, // depricated
      sessionId,
    });
  }

  function newOnEventHandlers(port, listeners) {
    let onMessage;
    return {
      addListener: (listener) => {
        listeners.push(listener);
        if (!onMessage) {
          onMessage = ({ data }) => {
            if (!data.method || data.method === "Target.detachedFromTarget")
              return;
            const { method, params, sessionId } = data;
            const targetId = sessionsToTargets[sessionId];
            const target = { targetId, sessionId };
            for (let listener of listeners) {
              listener(target, method, params);
            }
          };
          port.addEventListener("message", onMessage);
        }
      },
      removeListener: (listener) => {
        for (let i = listeners.length - 1; i >= 0; i--) {
          if (listeners[i] === listener) listeners.splice(i, 1);
        }
        if (!listeners.length && onMessage) {
          port.removeEventListener("message", onMessage);
          onMessage = null;
        }
      },
    };
  }

  function newOnDetachHandlers(port, listeners) {
    let onMessage;
    return {
      addListener: (listener) => {
        listeners.push(listener);
        if (!onMessage) {
          onMessage = ({ data }) => {
            const { method, params } = data;
            if (method !== "Target.detachedFromTarget") return;
            const reason = "canceled_by_user";
            for (let listener of listeners) {
              listener(params, reason);
            }
          };
          port.addEventListener("message", onMessage);
        }
      },
      removeListener: (listener) => {
        for (let i = listeners.length - 1; i >= 0; i--) {
          if (listeners[i] === listener) listeners.splice(i, 1);
        }
        if (!listeners.length && onMessage) {
          port.removeEventListener("message", onMessage);
          onMessage = null;
        }
      },
    };
  }

  return {
    sendCommand,
    attach,
    detach,
    getTargets,
    onEvent: newOnEventHandlers(port, onEventListeners),
    onDetach: newOnDetachHandlers(port, onDetachListeners),
  };
}
