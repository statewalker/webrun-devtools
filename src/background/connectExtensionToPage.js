import { newRegistry } from '@statewalker/utils';
import { 
  TYPE_CONTENT_CONNECTION,
  TYPE_CONNECTION_ERROR, 
  TYPE_CONNECTION_REQUEST, 
  TYPE_CONNECTION_RESPONSE, 
  TYPE_EXTENSION_READY
} from '../libs/constants.js';
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
    if (port.name !== connectionType) {
      port.disconnect();
      return;
    }
    const { sender } = port; 
    const [reg, cln] = newRegistry();

    const cleanAll = cln;

    port.onDisconnect.addListener(cleanAll);
    reg(() => port.onDisconnect.removeListener(cleanAll));

    const channel = new MessageChannel();
    const onMessage = (data) => {
      try {
        channel.port1.postMessage(data);
      } catch (err) {
        cleanAll();
      }
    }
    port.onMessage.addListener(onMessage);
    reg(() => port.onMessage.removeListener(onMessage))

    channel.port1.onmessage = ({ data }) => {
      try {
        port.postMessage(data);
      } catch (err) {
        cleanAll();
      }
    };  
    reg(onConnect(channel.port2, sender));
    reg(() => channel.port1.onmessage = null);
    reg(() => channel.port1.close());
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
 * @param {string} options.apiKey apiKey used to check that the page is authorized
 * to establish connection with this extension
 * @returns {function} cleanup function
 */
export async function connectExtensionToPage({
  connectionType = TYPE_CONTENT_CONNECTION,
  tabId,
  apiKey
}) {
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
        typeExtensionReady: TYPE_EXTENSION_READY,
        typeConnectionRequest: TYPE_CONNECTION_REQUEST,
        typeConnectionResponse: TYPE_CONNECTION_RESPONSE,
        typeConnectionError: TYPE_CONNECTION_ERROR,
        apiKey
      }
    ],
    // A standalone script without any dependencies.
    // So we can not use imported / global statements here.
    func: async function injectedFunction({
      connectionType,
      typeExtensionReady,
      typeConnectionRequest,
      typeConnectionResponse,
      typeConnectionError,
      apiKey
    }) {
      function newPortToBackground() {
        let port;
        const channel = new MessageChannel();
        channel.port1.onmessage = async ({ data }) => {
          if (!port) {
            port = await chrome.runtime.connect({ name: connectionType });
            port.onDisconnect.addListener(() => { port = null; });
            port.onMessage.addListener((data) => {
              channel.port1.postMessage(data);
            });
          }
          port.postMessage(data);
        }
        return channel.port2;
      }

      window.addEventListener('message', async function messageListener(ev) {
        const { data } = ev;
        let responseData, responsePort;
        if (data?.type === typeConnectionRequest) {
          const { callId } = data;
          if (data?.apiKey === apiKey) {
            responsePort = newPortToBackground();
            responseData = { type: typeConnectionResponse, callId };
          } else {
            const message =
              'The page is not authorized to establish connection with this extension.';
            responseData = {
              type: typeConnectionError,
              callId,
              message
            };
            console.warn(message);
          }
          window.postMessage(responseData, '*', responsePort ? [responsePort] : []);
        }
      });
      window.postMessage({ type: typeExtensionReady }, '*');
    }
  });
}
