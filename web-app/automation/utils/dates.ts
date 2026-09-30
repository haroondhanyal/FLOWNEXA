// DATE HELPERS: use local YYYY-MM-DD strings accepted by native date controls.
export function dateOffset(daysFromToday: number, from = new Date()) {
  const value = new Date(from.getFullYear(), from.getMonth(), from.getDate() + daysFromToday);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
export function isIsoDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`)); }
