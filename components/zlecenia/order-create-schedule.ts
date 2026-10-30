/** Cywilny czas Europe/Warsaw w formacie `YYYY-MM-DDTHH:mm`, jak `datetime-local`. */
export function warsawLocal(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(date).replace(" ", "T");
}

export function addCalendarDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
}

/** Dodaje minuty do lokalnego `YYYY-MM-DDTHH:mm` bez przeliczania strefy. */
export function addMinutes(local: string, minutes: number) {
  const [date = "", time = ""] = local.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const utc = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, (minute ?? 0) + minutes));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}T${pad(utc.getUTCHours())}:${pad(utc.getUTCMinutes())}`;
}

/** Start za godzinę, a po 18:00 — jutro o 9:00. Koniec wynika z czasu usługi. */
export function initialWindow(now: Date, durationMin: number) {
  const soon = warsawLocal(new Date(now.getTime() + 60 * 60_000));
  const from = Number(soon.slice(11, 13)) >= 18 ? `${addCalendarDays(soon.slice(0, 10), 1)}T09:00` : soon;
  return { from, to: addMinutes(from, durationMin > 0 ? durationMin : 120) };
}

export function durationLabel(minutes: number) {
  if (minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const source = parts.length > 1 ? parts.slice(0, 2) : parts.slice(0, 1);
  return source.map((part) => part[0] ?? "").join("").toLocaleUpperCase("pl-PL");
}

const warsawNoon = (isoDate: string) => new Date(`${isoDate}T12:00:00+01:00`);

export function dayChoices(today: string) {
  return [0, 1, 2].map((offset) => {
    const date = addCalendarDays(today, offset);
    const stamp = warsawNoon(date);
    const weekday = new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", weekday: "short" }).format(stamp).replace(".", "");
    const dayMonth = new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "short" }).format(stamp).replace(".", "");
    const title = offset === 0 ? "Dziś" : offset === 1 ? "Jutro" : `${weekday.charAt(0).toLocaleUpperCase("pl-PL")}${weekday.slice(1)}`;
    return { date, title, dayMonth };
  });
}
