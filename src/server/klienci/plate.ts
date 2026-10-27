/** Porównanie tablic: wielkość liter, spacje i myślniki nie mają znaczenia. */
export function normalizePlate(plate: string) {
  return plate.normalize("NFKC").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function normalizeEmail(email: string | null | undefined) {
  const value = email?.trim().toLowerCase();
  return value || null;
}

/** Cyfry z kierunkowym 48 dla dziewięciocyfrowych numerów PL. */
export function normalizePhone(phone: string | null | undefined) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (!digits) return null;
  if (digits.length === 9) return `48${digits}`;
  if (digits.startsWith("48") && digits.length === 11) return digits;
  return digits;
}
