export function get(obj, path) {
  path = toPath(path);
  return doGet(obj, path, 0);
  function doGet(obj, path, pos) {
    if (pos === path.length) return obj;
    const name = path[pos];
    const value = obj[name];
    if (pos < path.length - 1) {
      return doGet(value, path, pos + 1);
    } else {
      return value;
    }
  }
}
export function set(obj = {}, path, value) {
  path = toPath(path);
  return doUpdate(obj, path, 0, value);
  function doUpdate(obj, path, pos, value) {
    if (pos >= path.length)
      return value;
    const name = path[pos];
    const oldValue = obj[name];
    const newValue = doUpdate(oldValue || {}, path, pos + 1, value);
    if (oldValue !== newValue) {
      if (value === undefined && pos === path.length - 1) {
        delete obj[name];
      } else {
        obj[name] = newValue;
      }
    }
    return obj;
  }

  function toPath(path) {
    if (!path)
      return [];
    if (typeof path === 'string')
      return path.split('.');
    return path;
  }
}