export function loadConnectionInfo({
  port,
  versionUrl = `http://127.0.0.1:${port}/json/version`,
  http: log = console.log,
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
    const resolve = y;
    close = n;
    timerId = setInterval(async () => {
      try {
        const version = await fetchJson(versionUrl);
        clearInterval(timerId);
        timerId = 0;
        resolve(version);
      } catch (e) {
        // log(e);
      }
    }, retryPeriod);
  });
  promise.finally(() => timerId && clearInterval(timerId));
  return Object.assign(promise, { close });
}
