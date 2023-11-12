import newRegistry from './newRegistry.js';

const TYPE_CONTENT_CONNECTION = 'content-connection';
const TYPE_CONNECTION_REQUEST = 'connection-request';
const TYPE_CONNECTION_RESPONSE = 'connection-response';
const TYPE_CONNECTION_ERROR = 'connection-error';

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
export async function connectExtensionToPage({
  connectionType = TYPE_CONTENT_CONNECTION,
  tabId,
  secret
}) {
  const callId = `call-${Date.now()}-${Math.random()}`;
  // Set listeners for messages comming from the page.
  await chrome.scripting.executeScript({
    target: {
      tabId,
      allFrames: true
    },
    injectImmediately: true,
    world: 'ISOLATED',
    args: [
      {
        connectionType,
        typeConnectionRequest: TYPE_CONNECTION_REQUEST,
        typeConnectionResponse: TYPE_CONNECTION_RESPONSE,
        typeConnectionError: TYPE_CONNECTION_ERROR,
        secret,
        callId
      }
    ],
    // A standalone script without any dependencies.
    // So we can not use imported / global statements here.
    func: async function injectedFunction({
      connectionType,
      typeConnectionRequest,
      typeConnectionResponse,
      typeConnectionError,
      secret,
      callId
    }) {
      window.addEventListener('message', async function messageListener(ev) {
        const { data, ports } = ev;
        if (data?.type === typeConnectionRequest && data?.callId === callId) {
          const channelPort = ports[0];
          if (data?.secret === secret) {
            // window.removeEventListener('message', messageListener);
            const port = await chrome.runtime.connect({ name: connectionType });
            port.onMessage.addListener((data) => channelPort.postMessage(data));
            channelPort.onmessage = ({ data }) => port.postMessage(data);
            port.onDisconnect.addListener(() => {
              channelPort.onmessage = null;
              channelPort.close();
            });
            // Reply to the page using the recieved port
            channelPort.postMessage({ type: typeConnectionResponse, callId });
          } else {
            const message =
              'The page is not authorized to establish connection with this extension.';
            channelPort.postMessage({
              type: typeConnectionError,
              callId,
              message
            });
            channelPort.close();
            console.warn(message);
          }
        }
      });
    }
  });

  // Send a message from the page to establish connection.
  await chrome.scripting.executeScript({
    target: {
      tabId,
      allFrames: true
    },
    injectImmediately: true,
    world: 'MAIN',
    args: [
      {
        connectionType,
        typeConnectionRequest: TYPE_CONNECTION_REQUEST,
        typeConnectionResponse: TYPE_CONNECTION_RESPONSE,
        typeConnectionError: TYPE_CONNECTION_ERROR,
        callId
      }
    ],
    // A standalone script without any dependencies.
    // So we can not use imported / global statements here.
    func: async function injectedFunction({
      typeConnectionRequest,
      typeConnectionError,
      callId
    }) {
      if (!window.___debuggerPromise) {
        let resolve, reject;
        window.___debuggerPromise = new Promise(
          (y, n) => ((resolve = y), (reject = n))
        );
        window.___debuggerPromise.resolve = resolve;
        window.___debuggerPromise.reject = reject;
      }
      window.___debuggerPromise.resolve(async ({ secret } = {}) => {
        return new Promise((resolve, reject) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = function recieveResponse({ data }) {
            if (data.callId !== callId) return; // It should never happen
            // This is the response from the ISOLATED world. It happens once.
            channel.port1.onmessage = null;
            if (data.type === typeConnectionError) {
              reject(new Error(data.message));
            } else {
              resolve(channel.port1);
            }
          };
          // Send the pair port to the ISOLATED world.
          // We will wait for the reply before returning.
          // It guaranties us that connections to the background
          // is already established.
          window.postMessage(
            {
              type: typeConnectionRequest,
              secret,
              callId
            },
            '*',
            [channel.port2]
          );
        });
      });
    }
  });
}
