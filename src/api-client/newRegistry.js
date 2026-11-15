import { newRegistry as untypedNewRegistry } from "@statewalker/utils";

/**
 * A cleanup function returned by `register`: it removes the registration and
 * runs the registered action, unless `skip` is true.
 * @typedef {((skip?: boolean) => unknown) & { action?: () => unknown }} Registration
 */

/**
 * The registry of `@statewalker/utils`, re-exported with types: that package
 * ships none, and it is bundled into this one, so consumers do not install it.
 * @type {(onError?: (error: unknown) => void) => [
 *   register: (action?: () => unknown) => Registration,
 *   clear: () => void,
 *   unregister: (action: () => unknown) => void,
 * ] & {
 *   register: (action?: () => unknown) => Registration,
 *   clear: () => void,
 *   unregister: (action: () => unknown) => void,
 * }}
 */
export const newRegistry = untypedNewRegistry;
