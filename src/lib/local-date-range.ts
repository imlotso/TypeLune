// Calendar boundaries use the administrator's local time, including DST.
export function localDateBoundary(value: string, nextDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1970 || year > 9999) return undefined;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return undefined;
  if (nextDay) date.setDate(date.getDate() + 1);
  return date.getTime();
}
