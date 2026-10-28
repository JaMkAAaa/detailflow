const instants = { zone: "Europe/Warsaw", locale: "pl-PL" } as const;

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat(instants.locale, { hour: "2-digit", minute: "2-digit", timeZone: instants.zone }).format(new Date(iso));
}

export function formatDay(iso: string) {
  return new Intl.DateTimeFormat(instants.locale, { day: "numeric", month: "long", timeZone: instants.zone }).format(new Date(iso));
}

export function formatDayYear(iso: string) {
  return new Intl.DateTimeFormat(instants.locale, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: instants.zone }).format(new Date(iso));
}

export const formatDayTime = (iso: string) => `${formatDay(iso)}, ${formatTime(iso)}`;
