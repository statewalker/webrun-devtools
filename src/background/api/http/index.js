import { ioHandle } from "@statewalker/webrun-ports";
import { newHttpServer } from "@statewalker/webrun-http";
import { encode, decode } from "../../../libs/serd.js";

export function getHttpApi({ port } = {}) {
  return {
    fetch : async (url, { channelName, ...options }) => {
      async function* serdServer(input) {
        const server = newHttpServer(fetch);
        yield* encode(server(decode(input)));
      }
      for await (const tick of ioHandle(port, serdServer, {
        channelName,
        // log: console.warn.bind(console, "SERVER")
      })) {
        break;
      }
      return { channelName, status : 'OK' };
    }
  };
}
