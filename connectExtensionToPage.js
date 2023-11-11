import newRegistry from './newRegistry.js';

const TYPE_CONTENT_CONNECTION = 'content-connection';
const TYPE_CONNECTION_REQUEST = 'connection-request';
const TYPE_CONNECTION_RESPONSE = 'connection-response';

/**
 * This wrapper function transforms chrome.runtime.onConnect ports
 * to simple MessageChannel ports. It validates that the port name
 * is equal to the connectionType and calls onConnect callback with two arguments:
 * - port (MessageChannel.Port instance) a simple port used to bi-directional messaging
 * - sender (https://developer.chrome.com/docs/extensions/reference/runtime/#type-MessageSender instance)
 *
 * @param {object} options options object
 * @param {string} options.connectionType name of the connection
 * @param {function} options.onConnect function that will be called when
 * a new connection is established; it recieves two arguments - port and sender:
 * - port (MessageChannel.Port instance) a simple port used to bi-directional messaging
 * - sender (https://developer.chrome.com/docs/extensions/reference/runtime/#type-MessageSender instance)
 * @returns {function} cleanup function removing all listeners
 */
export function newConnectionHandler({
  connectionType = TYPE_CONTENT_CONNECTION,
  onConnect
}) {
  const [register, cleanup] = newRegistry();
  const connectionHandler = (port) => {
    if (port.name !== connectionType) return;
    const { sender } = port;
    const channel = new MessageChannel();
    port.onMessage.addListener((data) => channel.port1.postMessage(data));
    channel.port1.onmessage = ({ data }) => port.postMessage(data);
    const reg = onConnect(channel.port2, sender);
    const closePort = register(() => {
      channel.port1.onmessage = null;
      channel.port1.close();
      channel.port2.close();
      if (typeof reg === 'function') reg();
    });
    port.onDisconnect.addListener(closePort);
  };
  chrome.runtime.onConnect.addListener(connectionHandler);
  register(() => chrome.runtime.onConnect.removeListener(connectionHandler));
  return cleanup;
}

/**
 * This method registers content listeners establishing connections between
 * the page and this extension.
 * @param {object} options options object
 * @param {number} options.connectionType name of the connection;
 * the same value as used in the #newConnectionHandler method
 * @param {number} options.tabId tab identifier
 * @param {string} options.secret secret used to check that the page is authorized
 * to establish connection with this extension
 * @returns {function} cleanup function
 */
export function connectExtensionToPage({
  connectionType = TYPE_CONTENT_CONNECTION,
  tabId,
  secret
}) {
  chrome.scripting.executeScript({
    target: {
      tabId,
      allFrames: true
    },
    injectImmediately: true,
    args: [
      {
        connectionType,
        typeConnectionRequest: TYPE_CONNECTION_REQUEST,
        typeConnectionResponse: TYPE_CONNECTION_RESPONSE,
        secret
      }
    ],
    // A standalone script without any dependencies.
    // So we can not use imported / global statements here.
    func: async function injectedFunction({
      connectionType,
      typeConnectionRequest,
      typeConnectionResponse,
      secret
    }) {
      window.addEventListener('message', async function messageListener(ev) {
        const { data } = ev;
        if (data?.type === typeConnectionRequest && data?.secret === secret) {
          window.removeEventListener('message', messageListener);
          const port = await chrome.runtime.connect({ name: connectionType });
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
              ...data,
              type: typeConnectionResponse
            },
            '*',
            [channel.port2]
          );
        }
      });
    }
  });
}
