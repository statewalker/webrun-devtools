// function connectPorts(port1, port2) {
//   bind('1 -> 2', port1, port2);
//   bind('2 -> 1', port2, port1);
//   function bind(msg, a, b) {
//     a.onmessage = (ev) => {
//       // console.log(msg, ev);
//       b.postMessage(ev.data, ev.ports);
//     };
//   }
// }

// -----------------------------------------------
// TODO: check how to establish connections only with the top-level documents
export async function establishExtensionToPageConnection(tabId) {
  const connectionId = `connection-${tabId}`;
  const promise = new Promise((resolve) => {
    function onConnect(port) {
      if (port.name !== connectionId) return;
      chrome.runtime.onConnect.removeListener(onConnect);
      const channel = new MessageChannel();
      port.onMessage.addListener((data) => channel.port1.postMessage(data));
      channel.port1.onmessage = ({ data }) => port.postMessage(data);
      port.onDisconnect.addListener(() => {
        channel.port1.onmessage = null;
        channel.port1.close();
        channel.port2.close();
      });

      resolve(channel.port2);
    }
    chrome.runtime.onConnect.addListener(onConnect);
    chrome.scripting.executeScript({
      target: { tabId },
      func: injectedFunction,
      args: [connectionId]
    });
  });
  return promise;

  async function injectedFunction(connectionId) {
    const port = await chrome.runtime.connect({
      name: connectionId
    });
    const channel = new MessageChannel();
    port.onMessage.addListener((data) => channel.port1.postMessage(data));
    channel.port1.onmessage = ({ data }) => port.postMessage(data);
    port.onDisconnect.addListener(() => {
      channel.port1.onmessage = null;
      channel.port1.close();
      channel.port2.close();
    });
    window.postMessage(
      {
        type: 'handshake',
        source: 'extension',
        connectionId
      },
      '*',
      [channel.port2]
    );
  }
}
