/**
 * A small fake of the `chrome.*` APIs the background code uses, for unit tests.
 * Only what the tests need: event objects and `chrome.debugger`.
 */
export function newFakeEvent() {
  const listeners = new Set();
  return {
    addListener: (listener) => listeners.add(listener),
    removeListener: (listener) => listeners.delete(listener),
    hasListeners: () => listeners.size > 0,
    dispatch: (...args) => {
      for (const listener of [...listeners]) listener(...args);
    },
  };
}

/**
 * @param {{ sendCommand?: (target: object, method: string, params?: object) => unknown }} [options]
 * `sendCommand` stands for the browser: it may dispatch events (through the returned
 * `debugger.onEvent.dispatch`) before it returns, as a page that loads at once does.
 */
export function newFakeChrome({ sendCommand = async () => ({}) } = {}) {
  return {
    debugger: {
      onEvent: newFakeEvent(),
      onDetach: newFakeEvent(),
      attach: async () => {},
      detach: async () => {},
      sendCommand: async (target, method, params) => await sendCommand(target, method, params),
    },
  };
}

/**
 * Two connected ports whose messages are copied as JSON, as `chrome.runtime` ports copy
 * them (an `Error` becomes `{}`); MessagePorts would keep errors through structured clone.
 * Each side has `postMessage`, `addEventListener("message")` and `removeEventListener`.
 */
export function newJsonPortPair() {
  const newSide = () => {
    const target = new EventTarget();
    return {
      peer: undefined,
      addEventListener: (type, listener) => target.addEventListener(type, listener),
      removeEventListener: (type, listener) => target.removeEventListener(type, listener),
      dispatch: (data) => {
        const event = new Event("message");
        Object.defineProperty(event, "data", { value: data });
        target.dispatchEvent(event);
      },
      postMessage(data) {
        const copy = JSON.parse(JSON.stringify(data));
        setTimeout(() => this.peer.dispatch(copy), 0);
      },
    };
  };
  const a = newSide();
  const b = newSide();
  a.peer = b;
  b.peer = a;
  return [a, b];
}
