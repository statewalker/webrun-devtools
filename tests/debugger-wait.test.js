import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  $once,
  sendCommandAndWait,
  waitForDebuggerEvent,
} from "../src/background/api/debugger/$once.js";
import { getDebuggerApi } from "../src/background/api/debugger/index.js";
import { newFakeChrome } from "./fake-chrome.js";

const target = { tabId: 7 };

describe("debugger event waits (statewalker/webrun-devtools#20)", () => {
  let chrome;
  beforeEach(() => {
    chrome = newFakeChrome({
      // A page that loads at once: the load event fires before Page.navigate returns.
      sendCommand: async (target, method) => {
        if (method === "Page.navigate") {
          chrome.debugger.onEvent.dispatch(target, "Page.loadEventFired", { timestamp: 1 });
          return { frameId: "frame-1" };
        }
        return {};
      },
    });
    vi.stubGlobal("chrome", chrome);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sendCommandAndWait sees an event fired before the command returns", async () => {
    const { result, event } = await sendCommandAndWait(
      target,
      "Page.navigate",
      { url: "http://localhost/" },
      "Page.loadEventFired",
      { timeout: 1000 },
    );
    expect(result).toEqual({ frameId: "frame-1" });
    expect(event).toEqual({ method: "Page.loadEventFired", params: { timestamp: 1 } });
    expect(chrome.debugger.onEvent.hasListeners()).toBe(false);
    expect(chrome.debugger.onDetach.hasListeners()).toBe(false);
  });

  it("is part of the debugger API given to pages", () => {
    const api = getDebuggerApi();
    expect(typeof api.sendCommandAndWait).toBe("function");
    expect(typeof api.$once).toBe("function");
  });

  it("$once rejects after its timeout when the event never comes", async () => {
    vi.useFakeTimers();
    const wait = $once(target, "Page.loadEventFired", { timeout: 500 });
    const check = expect(wait).rejects.toThrow(
      'Timed out after 500 ms waiting for the debugger event "Page.loadEventFired".',
    );
    await vi.advanceTimersByTimeAsync(500);
    await check;
    expect(chrome.debugger.onEvent.hasListeners()).toBe(false);
  });

  it("$once has a default timeout", async () => {
    vi.useFakeTimers();
    const wait = $once(target, "Page.loadEventFired");
    const check = expect(wait).rejects.toThrow(/Timed out after 30000 ms/);
    await vi.advanceTimersByTimeAsync(30 * 1000);
    await check;
  });

  it("sendCommandAndWait rejects after its timeout when the event never comes", async () => {
    vi.useFakeTimers();
    const wait = sendCommandAndWait(target, "Page.reload", {}, "Page.loadEventFired", {
      timeout: 200,
    });
    const check = expect(wait).rejects.toThrow(/Timed out after 200 ms/);
    await vi.advanceTimersByTimeAsync(200);
    await check;
  });

  it("$once resolves on the target's event and ignores other targets and events", async () => {
    const wait = $once(target, "Page.loadEventFired", { timeout: 1000 });
    chrome.debugger.onEvent.dispatch({ tabId: 8 }, "Page.loadEventFired", { other: true });
    chrome.debugger.onEvent.dispatch(target, "Page.frameNavigated", {});
    chrome.debugger.onEvent.dispatch({ tabId: 7 }, "Page.loadEventFired", { mine: true });
    await expect(wait).resolves.toEqual({
      method: "Page.loadEventFired",
      params: { mine: true },
    });
  });

  it("a wait rejects when the debugger detaches from the target", async () => {
    const wait = $once(target, "Page.loadEventFired", { timeout: 1000 });
    chrome.debugger.onDetach.dispatch({ tabId: 8 }, "target_closed");
    chrome.debugger.onDetach.dispatch(target, "target_closed");
    await expect(wait).rejects.toThrow(/detached \(target_closed\)/);
    expect(chrome.debugger.onEvent.hasListeners()).toBe(false);
  });

  it("sendCommandAndWait rejects with the command's error and stops listening", async () => {
    chrome.debugger.sendCommand = async () => {
      throw new Error("Cannot navigate to invalid URL");
    };
    await expect(
      sendCommandAndWait(target, "Page.navigate", { url: "bad" }, "Page.loadEventFired"),
    ).rejects.toThrow("Cannot navigate to invalid URL");
    expect(chrome.debugger.onEvent.hasListeners()).toBe(false);
  });

  it("a timeout of 0 waits without a limit", async () => {
    vi.useFakeTimers();
    const { promise, cancel } = waitForDebuggerEvent(target, "Page.loadEventFired", {
      timeout: 0,
    });
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    chrome.debugger.onEvent.dispatch(target, "Page.loadEventFired", {});
    await expect(promise).resolves.toEqual({ method: "Page.loadEventFired", params: {} });
    cancel();
  });
});
