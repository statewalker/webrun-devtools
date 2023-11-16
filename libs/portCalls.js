export function listenPort(port, handler) {
  const onMessage = async function callback(event) {
    const { callId, params } = event.data;
    let result, error, type = 'ok';
    try {
      result = await handler(params);
    } catch (e) {
      error = e.message;
      type = 'error';
    }
    port.postMessage({ callId, type, result, error });
  }
  port.addEventListener("message", onMessage);
  return () => port.removeEventListener("message", onMessage);
}

export async function callPort(port, params, timeout = 1000) {
  const callId = `call-${Date.now()}-${Math.random()}`
  let timerId, onMessage;
  const promise = new Promise((resolve, reject) => {
    timerId = setTimeout(() => reject(new Error('Call timeout')), timeout);
    onMessage = (event) => {
      if (event.data?.callId !== callId) return;
      if (event.data?.type === 'error') {
        reject(new Error(event.data?.error));
      } else {
        resolve(event.data?.result);
      }
    }
    port.addEventListener("message", onMessage);
  });
  promise.finally(() => clearTimeout(timerId));
  promise.finally(() => port.removeEventListener("message", onMessage));
  port.postMessage({ callId, params });
  return promise;
}