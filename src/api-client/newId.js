export function newId(prefix = "id-") {
  return `${prefix}${Date.now()}-${String(Math.random()).substring(2)}`;
}
