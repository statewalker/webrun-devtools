// import * as Comlink from 'https://unpkg.com/comlink/dist/esm/comlink.mjs';
import * as Comlink from '../libs/comlink.js';

export default async function connectPageToExtension({ secret, onEvent = () => {} }) {
  if (!window.___debuggerPromise) {
    let resolve, reject;
    window.___debuggerPromise = new Promise(
      (y, n) => ((resolve = y), (reject = n))
    );
    window.___debuggerPromise.resolve = resolve;
    window.___debuggerPromise.reject = reject;
  }
  const getPort = await window.___debuggerPromise;
  const port = await getPort({ secret });

  const { methods } = await new Promise((resolve) => {
    Comlink.expose((messageType, ...args) => {
      if (messageType === 'onConnect') {
        resolve(args[0]);
      }
      if (messageType === 'onEvent') {
        onEvent(messageType, ...args);
      }
    }, port);
  });
  const connector = Comlink.wrap(port);
  const api = methods.reduce((api, method) => {
    const [ns, name] = method.split('_');
    const obj = api[ns] || (api[ns] = {});
    obj[name] = async (...args) => await connector[method](...args);
    return api;
  }, {});
  return api;
}
