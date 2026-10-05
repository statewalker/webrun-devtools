export async function $once(target, event) {
  let handler;
  const promise = new Promise((resolve) => {
    handler = (source, method, params) => {
      if (source.tabId !== target.tabId) return;
      if (method !== event) return;
      resolve({
        method,
        params,
      });
    };
    chrome.debugger.onEvent.addListener(handler);
  });
  promise.finally(() => chrome.debugger.onEvent.removeListener(handler));
  return promise;
}
