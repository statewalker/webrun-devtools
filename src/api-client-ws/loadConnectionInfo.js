export function loadConnectionInfo({
  port,
  url = `http://127.0.0.1:${port}/json`,
  log = console.log,
  retryPeriod = 500,
  fetchJson = async (url) => {
    const res = await fetch(url, {
      mode: "cors",
    });
    // if (!res.ok) throw new Error("Can not fetch");
    return await res.json();
  },
}) {
  let timerId, close;
  let promise = new Promise((y, n) => {
    const resolve = y; close = n;
    timerId = setInterval(async () => {
      try {
        const info = await fetchJson(url);
        clearInterval(timerId);
        timerId = 0;
        resolve(info);
      } catch (e) {
        // log(e);
      }
    }, retryPeriod);
  });
  promise.finally(() => timerId && clearInterval(timerId));
  return Object.assign(promise, { close });
}
