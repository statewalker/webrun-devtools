import { newRegistry } from "@statewalker/utils";
import { connectPageToExtension } from "./connectPageToExtension.js";

export * from "./connectPageToExtension.js";
export * from "./initApi.js";
export * from "./openPortToExtension.js";
export { newRegistry };
export default connectPageToExtension;
