import {
  TYPE_CONNECTION_ERROR,
  TYPE_CONNECTION_REQUEST,
  TYPE_CONNECTION_RESPONSE,
  TYPE_EXTENSION_READY,
} from "../libs/constants.js";
import { newId } from "./newId.js";

export async function openPortToExtension({ apiKey, timeout = 1000 * 5 }) {
  await new Promise((resolve) => {
    const finish = () => setTimeout(resolve, 10);
    if (document.readyState === "complete") {
      finish();
    } else {
      document.addEventListener("DOMContentLoaded", finish);
    }
  });
  console.log("[openPortToExtension]", { apiKey, timeout });
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
        { type: TYPE_CONNECTION_REQUEST, apiKey, callId },
        "*"
      );
    }
    onMessage = (event) => {
      if (event.source !== window) return;
      const { data, ports } = event;
      if (data?.type === TYPE_EXTENSION_READY) {
        requestConnection();
      } else if (data?.callId === callId) {
        resolved = true;
        if (data?.type === TYPE_CONNECTION_ERROR) {
          reject(new Error(data.message));
        } else if (data.type === TYPE_CONNECTION_RESPONSE) {
          resolve(ports[0]);
        }
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
