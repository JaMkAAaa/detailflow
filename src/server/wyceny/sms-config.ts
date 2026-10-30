export function smsConfigured() {
  return !!process.env.SMSAPI_TOKEN?.trim() && !!process.env.SMSAPI_SENDER?.trim();
}

// Zakres #149: polskie numery, jeden odbiorca; bez dowolnych list SMSAPI.
export function normalizeSmsPhone(phone: string | null | undefined): string | null {
  const value = (phone ?? "").replace(/[\s()-]/g, "");
  if (/^[1-9]\d{8}$/.test(value)) return `48${value}`;
  if (/^(?:\+|00)?48[1-9]\d{8}$/.test(value)) return value.replace(/^(?:\+|00)/, "");
  return null;
}
