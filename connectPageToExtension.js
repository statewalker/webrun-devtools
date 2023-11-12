// import * as Comlink from 'https://unpkg.com/comlink/dist/esm/comlink.mjs';
import * as Comlink from './comlink.js';

export async function connectPageToExtension({ secret, onEvent = () => {} }) {
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
  Comlink.expose(onEvent, port);
  const api = Comlink.wrap(port);
  return api;
}
