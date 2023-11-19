import { del, get, set } from './idb-keyval.js';

const KEY = "debugger-secret";

export async function loadSecret() {
  return (await get(KEY)) || ''
}
export async function storeSecret(secret) {
  await set(KEY, secret);
}
