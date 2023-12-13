import {
  TYPE_CONTENT_CONNECTION,
  TYPE_CONNECTION_ERROR,
  TYPE_CONNECTION_REQUEST,
  TYPE_CONNECTION_RESPONSE,
  TYPE_EXTENSION_READY,
  METHOD_RESET_CONNECTION,
} from "../libs/constants.js";
import { callPort } from "@statewalker/webrun-ports";

function newPortToBackground() {
  let port;
  const channel = new MessageChannel();
  channel.port1.onmessage = async ({ data }) => {
    if (!port) {
      port = await chrome.runtime.connect({
        name: TYPE_CONTENT_CONNECTION,
      });
      port.onDisconnect.addListener(async () => {
        port = null;
        // Notify the content script that the connection
        // with the background is lost.
        await callPort(channel.port1, {
          method: METHOD_RESET_CONNECTION,
          args: [],
        });
      });
      port.onMessage.addListener((data) => {
        channel.port1.postMessage(data);
      });
    }
    port.postMessage(data);
  };
  return channel.port2;
}

window.addEventListener("message", async function messageListener(ev) {
  const { data } = ev;
  if (data?.type !== TYPE_CONNECTION_REQUEST) return;
  const { callId } = data;
  const responsePort = newPortToBackground();
  const responseData = { type: TYPE_CONNECTION_RESPONSE, callId };
  window.postMessage(responseData, "*", [responsePort]);
});
window.postMessage({ type: TYPE_EXTENSION_READY }, "*");
