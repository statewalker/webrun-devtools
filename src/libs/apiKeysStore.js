import { del, get, set } from "idb-keyval";

const KEY = "webrun-devtools-keys";

export async function loadApiKey() {
  return (await get(KEY)) || "";
}
export async function storeApiKey(apiKey) {
  if (!apiKey) {
    await del(KEY);
  } else {
    await set(KEY, apiKey);
  }
}
