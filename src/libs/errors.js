/**
 * Turns anything thrown into plain data that survives a `chrome.runtime` port, which copies
 * messages as JSON: an `Error` itself would arrive as `{}`, and the page would see
 * "[object Object]". webrun-ports' `deserializeError` rebuilds an `Error` from the data,
 * with its `name`, `code` and `stack`.
 * @param {unknown} error
 * @returns {{ name: string, message: string, code?: unknown, stack?: string }}
 */
export function toErrorData(error) {
  if (error !== null && typeof error === "object") {
    const { name, message, code, stack } = /** @type {Record<string, unknown>} */ (error);
    /** @type {{ name: string, message: string, code?: unknown, stack?: string }} */
    const data = {
      name: typeof name === "string" ? name : "Error",
      message: typeof message === "string" ? message : String(message ?? error),
    };
    if (code !== undefined) data.code = code;
    if (typeof stack === "string") data.stack = stack;
    return data;
  }
  return { name: "Error", message: String(error) };
}

/**
 * Wraps a webrun-ports `listenPort` handler so that what it throws reaches the caller as
 * `toErrorData` gives it.
 * @template {unknown[]} A, R
 * @param {(...args: A) => Promise<R> | R} handler
 * @returns {(...args: A) => Promise<R>}
 */
export function withErrorData(handler) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      throw toErrorData(error);
    }
  };
}
