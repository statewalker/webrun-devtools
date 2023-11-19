import newRegistry from "./newRegistry.js";

export async function provideLock(
  action,
  newId = () => `lock-${Date.now()}-${Math.round(Math.random() * Date.now())}`,
) {
  return await _setLock(action, newId(), "1", "2");
}
export async function useLock(lockId, action = () => {}) {
  return await _setLock(action, lockId, "2", "1");
}

// --------------------------------------------

export function newLock(lockId) {
  let resolve, promise = new Promise((y) => (resolve = y));
  navigator.locks.request(lockId, () => promise);
  return resolve;
}

export function awaitLock(lockId) {
  return new Promise((release) => {
    navigator.locks.request(lockId, release);
  });
}

export async function _setLock(
  action,
  lockId,
  localLockSuffix,
  remoteLockSuffix,
) {
  const [register, cleanup] = newRegistry();
  register(newLock(`${lockId}:${localLockSuffix}`));
  const remove = await action(lockId);
  if (remove) register(remove);
  const localLock = awaitLock(`${lockId}:${remoteLockSuffix}`);
  localLock.finally(cleanup);
  return Object.assign([register, cleanup], {
    register,
    cleanup,
  });
}
