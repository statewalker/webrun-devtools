import { loadConnectionInfo } from "./loadConnectionInfo.js";

export async function* listenConnectionInfo(options) {
  let close;
  try {
    while (true) {
      const promise = loadConnectionInfo(options);
      close = promise.close;
      const info = await promise;
      yield info;
    }
  } finally {
    close && close();
  }
}
