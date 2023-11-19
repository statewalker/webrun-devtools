import newRegistry from '../libs/newRegistry.js';
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
    const portId = port.name || ''
    if (portId.indexOf(connectionType) !== 0) {
      port.disconnect();
      return;
    }
    const { sender } = port; 
    const [reg, cln] = newRegistry();
    const r = (action) => reg(async () => {
      try {
        await action();
      } catch (error) {
        console.error(error);
      }
    })
    // const cleanAll = register(cln);
    const cleanAll = cln;

    port.onDisconnect.addListener(cleanAll);
    r(() => port.onDisconnect.removeListener(cleanAll));

    const channel = new MessageChannel();
    const onMessage = (data) => {
      try {
        channel.port1.postMessage(data);
      } catch (err) {
        cleanAll();
      }
    }
    port.onMessage.addListener(onMessage);
    r(() => port.onMessage.removeListener(onMessage))

    channel.port1.onmessage = ({ data }) => {
      try {
        port.postMessage(data);
      } catch (err) {
        cleanAll();
      }
    };  
    r(() => channel.port1.onmessage = null);
    r(() => channel.port1.close());
    r(() => console.log('Release connection'));
    r(onConnect(channel.port2, sender));
  };
  chrome.runtime.onConnect.addListener(connectionHandler);
  register(() => chrome.runtime.onConnect.removeListener(connectionHandler));
  register(() => console.log('newConnectionHandler cleanup'));
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
        secret
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
      secret
    }) {
      window.addEventListener('message', async function messageListener(ev) {
        const { data } = ev;
        let responseData, responsePort;
        if (data?.type === typeConnectionRequest) {
          const { callId } = data;
          if (data?.secret === secret) {
            const channel = new MessageChannel();
            responsePort = channel.port2;
            const channelPort = channel.port1;
            const portName = `${connectionType}-${callId}`;
            let port;
            channelPort.onmessage = async ({ data }) => {
              if (!port) {
                port = await chrome.runtime.connect({ name: portName });
                port.onMessage.addListener((d) => {
                  channelPort.postMessage(d);
                });
                port.onDisconnect.addListener(() => port = null);
              }
              port.postMessage(data);
            }
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
