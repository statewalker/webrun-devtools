import { del, get, set } from 'idb-keyval';

const KEY = "debugger-secret";

export async function loadSecret() {
  return (await get(KEY)) || ''
}
export async function storeSecret(secret) {
  if (!secret){
    await del(KEY);
  } else {
    await set(KEY, secret);
  }
}
