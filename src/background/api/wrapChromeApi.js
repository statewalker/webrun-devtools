export function wrapChromeApi(ns, methods) {
  return methods.reduce((api, method) => {
    if (method.startsWith("on")) {
      api[method] = (listener, ...args) => {
        const handler = (...params) => {
          listener(...params);
        };
        chrome[ns][method].addListener(handler, ...args);
        return () => chrome[ns][method].removeListener(handler);
      };
    } else {
      api[method] = async (...args) => await chrome[ns][method](...args);
    }
    return api;
  }, {});
}
