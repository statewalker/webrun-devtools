import {
  TYPE_CONNECTION_ERROR,
  TYPE_CONNECTION_REQUEST,
  TYPE_CONNECTION_RESPONSE,
  TYPE_EXTENSION_READY,
} from "../libs/constants.js";
import { newId } from "./newId.js";
import { version as clientApiVersion, protocolVersion } from "../../package.json";

function checkVersionsCompatibility(data) {
  if (data.protocolVersion !== protocolVersion) {
    const messages = [
      `Incompatible version of the WebRun DevTools browser extension protocol.`
    ];
    if (data.protocolVersion) {
      messages.push(`The expected extension protocol version is ${data.protocolVersion}.`);
      if (data.extensionVersion) {
        messages.push(`Try to use the client library version ${data.extensionVersion}.`)
        messages.push(`For example: https://unpkg.com/@statewalker/webrun-devtools@${data.extensionVersion}.`);
      }
    } else {
      messages.push(`Try to use the client library version 0.0.12.`)
      messages.push(`For example: https://unpkg.com/@statewalker/webrun-devtools@0.0.12.`);
    }
    return new Error(messages.join('\n'));
  }
}

export async function openPortToExtension({ apiKey, timeout = 1000 * 5 }) {
  await new Promise((resolve) => {
    const finish = () => setTimeout(resolve, 10);
    if (document.readyState === "complete") {
      finish();
    } else {
      document.addEventListener("DOMContentLoaded", finish);
    }
  });
  let timerId, onMessage;
  const promise = new Promise((resolve, reject) => {
    timerId = setTimeout(
      () =>
        reject(
          new Error(
            "Connection timeout. Please check that the WebRun DevTools browser extension is active."
          )
        ),
      timeout
    );
    let resolved = false;
    const callId = newId("call-");
    function requestConnection() {
      if (resolved) return;
      window.postMessage(
        { 
          type: TYPE_CONNECTION_REQUEST,
          apiKey,
          callId,
          protocolVersion,
          clientApiVersion
        },
        "*"
      );
    }
    onMessage = (event) => {
      if (event.source !== window) return;
      const { data, ports } = event;
      try {
        if (data?.type === TYPE_EXTENSION_READY) {
          requestConnection();
        } else if (data?.callId === callId) {
          resolved = true;
          if (data?.type === TYPE_CONNECTION_ERROR) {
            reject(new Error(data.message));
          } else if (data.type === TYPE_CONNECTION_RESPONSE) {
            const error = checkVersionsCompatibility(data);
            if (error) reject(error);
            else resolve(ports[0]);
          }
        }
      } catch (error) {
        reject(error);
        ports[0] && ports[0].close();
      }
    };
    window.addEventListener("message", onMessage);
    requestConnection();
  });
  promise.finally(() => clearTimeout(timerId));
  promise.finally(
    () => onMessage && window.removeEventListener("message", onMessage)
  );

  const port = await promise;
  port.start();
  return port;
}
