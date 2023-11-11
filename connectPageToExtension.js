// import * as Comlink from 'https://unpkg.com/comlink/dist/esm/comlink.mjs';
import * as Comlink from './comlink.js';
import newRegistry from './newRegistry.js';
const TYPE_CONNECTION_REQUEST = 'connection-request';
const TYPE_CONNECTION_RESPONSE = 'connection-response';

export async function connectPageToExtension({
  secret,
  onEvent = () => {},
  timeout = 1000 * 30, // 30 seconds,
  preloadTimeout = 30
}) {
  // Await document.readyState === 'complete'
  await new Promise((resolve) => {
    if (document.readyState === 'loading') {
      // Loading hasn't finished yet
      document.addEventListener('DOMContentLoaded', resolve);
    } else {
      // `DOMContentLoaded` has already fired
      resolve();
    }
  });
  // Await a little bit before sending the message.
  await new Promise((resolve) => setTimeout(resolve, preloadTimeout));

  // // Request next animation frame before sending the message.
  // await new Promise((resolve) => requestAnimationFrame(resolve));
  const [register, cleanup] = newRegistry();
  const callId = `call-${Date.now()}-${Math.random()}`;
  const promise = new Promise((resolve, reject) => {
    const timerId = setTimeout(
      () => reject({ message: 'Connection timeout' }),
      timeout
    );
    register(() => clearTimeout(timerId));

    function messageListener(ev) {
      const { data, ports } = ev;
      if (data.type === TYPE_CONNECTION_RESPONSE && data.callId === callId) {
        const [port] = ports;
        Comlink.expose(onEvent, port);
        const api = Comlink.wrap(port);
        resolve(api);
      }
    }
    window.addEventListener('message', messageListener);
    register(() => window.removeEventListener('message', messageListener));

    window.postMessage(
      {
        type: TYPE_CONNECTION_REQUEST,
        secret,
        callId
      },
      '*'
    );
  });
  promise.finally(cleanup);

  return promise;
}
