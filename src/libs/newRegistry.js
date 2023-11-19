export default function newRegistry(onError = console.error) {
  let counter = 0;
  const registrations = {};
  const register = (action) => {
    const id = counter++;
    return (registrations[id] = Object.assign(
      function (skip) {
        try {
          delete registrations[id];
          return !skip && action && action();
        } catch (error) {
          onError(error);
        }
      },
      { action }
    ));
  };
  const unregister = (action) =>
    Object.values(registrations).forEach((r) => r.action === action && r(true));
  const clear = () => Object.values(registrations).forEach((r) => r());
  return Object.assign([register, clear, unregister], {
    register,
    clear,
    unregister
  });
}