import { connectToWs } from "./connectToWs.js";
import { loadConnectionInfo } from "./loadConnectionInfo.js";
import { newDebuggerApi } from "./newDebuggerApi.js";

export * from "./connectToWs.js";
export * from "./listenConnectionInfo.js";
export * from "./loadConnectionInfo.js";
export * from "./newDebuggerApi.js";

export default async function connectToDebuggerApi({ wsUrl, ...options }) {
  if (!wsUrl) {
    const connectionInfo = await loadConnectionInfo(options);
    wsUrl = connectionInfo.webSocketDebuggerUrl;
  }
  const abortController = new AbortController();
  const port = await connectToWs(wsUrl, abortController.signal);
  const dbg = await newDebuggerApi(port);
  return {
    debugger: dbg,
    close: () => abortController.abort(),
  };
}
