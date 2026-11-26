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
