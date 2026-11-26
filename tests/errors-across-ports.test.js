import { deserializeError, listenPort } from "@statewalker/webrun-ports";
import { describe, expect, it } from "vitest";
import { toErrorData, withErrorData } from "../src/libs/errors.js";
import { newJsonPortPair } from "./fake-chrome.js";

// What callPort does on the page side, without its `promise.finally` chains, which leave
// unhandled rejections behind on every failed call.
function call(port, params) {
  return new Promise((resolve) => {
    const onMessage = (event) => {
      if (event.data?.callId !== "call-1") return;
      port.removeEventListener("message", onMessage);
      resolve(
        event.data.type === "response:error" ? deserializeError(event.data.error) : undefined,
      );
    };
    port.addEventListener("message", onMessage);
    port.postMessage({ type: "request", channelName: "", callId: "call-1", params });
  });
}

describe("errors across the extension ports (statewalker/webrun-devtools#21)", () => {
  async function callFailing(error) {
    const [page, background] = newJsonPortPair();
    const stop = listenPort(
      background,
      withErrorData(async () => {
        throw error;
      }),
    );
    try {
      return await call(page, { method: "x" });
    } finally {
      stop();
    }
  }

  it("keeps an Error's message, name and code", async () => {
    const error = new TypeError("No tab with id: 12345.");
    error.code = "E_TAB";
    const received = await callFailing(error);
    expect(received).toBeInstanceOf(Error);
    expect(received.message).toBe("No tab with id: 12345.");
    expect(received.name).toBe("TypeError");
    expect(received.code).toBe("E_TAB");
  });

  it("keeps the message of the authorization error", async () => {
    const received = await callFailing(
      new Error("The page is not authorized to establish connection with this extension."),
    );
    expect(received.message).toBe(
      "The page is not authorized to establish connection with this extension.",
    );
  });

  it("turns thrown strings and objects into messages", async () => {
    expect((await callFailing("plain text")).message).toBe("plain text");
    expect((await callFailing({ message: "from an object", code: 3 })).message).toBe(
      "from an object",
    );
    expect((await callFailing(undefined)).message).toBe("undefined");
  });

  it("toErrorData gives plain data that survives JSON", () => {
    const data = toErrorData(new RangeError("too far"));
    expect(JSON.parse(JSON.stringify(data))).toMatchObject({
      name: "RangeError",
      message: "too far",
    });
  });
});
