export function listenPort(port, handler) {
  const onMessage = async function callback(event) {
    console.log('[listenPort] onMessage', event.data);
    if (event.data?.type !== 'request') return;
    const { callId, params } = event.data;
    let result, error, type;
    try {
      result = await handler(params);
      type = 'response:result';
    } catch (e) {
      error = e.message;
      type = 'response:error';
    }
    port.postMessage({ callId, type, result, error });
  }
  port.addEventListener("message", onMessage);
  return () => port.removeEventListener("message", onMessage);
}

export async function callPort(port, params, timeout = 1000) {
  const callId = `call-${Date.now()}-${String(Math.random()).substring(2)}`
  let timerId, onMessage;
  const promise = new Promise((resolve, reject) => {
    timerId = setTimeout(() => reject(new Error('Call timeout')), timeout);
    onMessage = (event) => {
      if (event.data?.callId !== callId) return;
      if (event.data?.type === 'response:error') {
        reject(new Error(event.data?.error));
      } else if (event.data?.type === 'response:result') {
        resolve(event.data?.result);
      }
    }
    port.addEventListener("message", onMessage);
  });
  promise.finally(() => clearTimeout(timerId));
  promise.finally(() => port.removeEventListener("message", onMessage));
  port.postMessage({ type : 'request', callId, params });
  return promise;
}