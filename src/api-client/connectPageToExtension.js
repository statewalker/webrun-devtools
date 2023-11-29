import { openPortToExtension } from './openPortToExtension.js';
import { initApi } from './initApi.js';


export default async function connectPageToExtension({
  apiKey, timeout = 1000 * 5, callTimeout = 1000 * 60 * 5, closeTimeout = 1000 * 5,
}) {
  const port = await openPortToExtension({ apiKey, timeout });
  return await initApi(port, { callTimeout, closeTimeout });
}
