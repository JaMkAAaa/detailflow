import type { OrderPhoto } from "./order-types";

const STAGE_NAMES = ["Przyjęcie i mycie", "Korekta lakieru", "Aplikacja ceramiki", "Kontrola i odbiór"] as const;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const;
type PhotoType = (typeof PHOTO_TYPES)[number];

export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
export const MAX_PROTOCOL_DAMAGES = 30;

export class OrderMediaError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "OrderMediaError";
    this.status = status;
  }
}

/** Lokalny plik makiety, podgląd blob albo podpisany GET. Adres bucketu bez podpisu odpada. */
export function displayPhotoSrc(src?: string) {
  if (!src) return undefined;
  if (src.startsWith("blob:")) return src;
  if (src.startsWith("/") && !src.startsWith("//")) return src;
  return isSignedObjectUrl(src) ? src : undefined;
}

/** Podpisany URL obiektu. Ścieżka w buckecie bez `X-Amz-Signature` nie jest adresem podglądu. */
export function isSignedObjectUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return Boolean(parsed.searchParams.get("X-Amz-Signature"));
  } catch {
    return false;
  }
}

export function photoContentType(file: File): PhotoType | null {
  const type = file.type.toLowerCase();
  if ((PHOTO_TYPES as readonly string[]).includes(type)) return type as PhotoType;
  const name = file.name.toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".heic") || name.endsWith(".heif") || type === "image/heif") return "image/heic";
  return null;
}

export function currentPhotoStage(stages: { state: string }[]) {
  const current = stages.findIndex((stage) => stage.state === "current");
  if (current >= 0) return Math.min(4, current + 1);
  const done = stages.reduce((count, stage) => count + (stage.state === "done" ? 1 : 0), 0);
  return Math.min(4, Math.max(1, done || 1));
}

export type ListedPhoto = {
  id: string;
  no: number;
  stage: number;
  caption: string | null;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedAt: string | null;
  url: string;
  urlExpiresIn: number;
};

export type ProtocolDamageInput = {
  title: string;
  part: string;
  size?: string;
  x: number;
  y: number;
  photoId?: string;
};

export type ProtocolRecord = {
  number: string;
  createdAt: string;
  acceptedAt: string | null;
  createdByName: string | null;
  damages: {
    no: number;
    title: string;
    part: string;
    size: string | null;
    x: number;
    y: number;
    photoId?: string;
    photoNo?: number;
  }[];
};

function ordersUrl(studioId: string, workOrderId: string, suffix: string) {
  return `/api/studios/${encodeURIComponent(studioId)}/orders/${encodeURIComponent(workOrderId)}${suffix}`;
}

async function errorMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { error?: unknown } | null;
  return body && typeof body.error === "string" && body.error ? body.error : fallback;
}

/** Klucz spoza `studios/<studioId>/` nie idzie do confirm. Serwer i tak odpowie 403. */
function assertStudioKey(studioId: string, key: unknown) {
  if (typeof key !== "string" || !key.startsWith(`studios/${studioId}/`)) throw new OrderMediaError("Brak dostępu.", 403);
  return key;
}

function parseListedPhoto(value: unknown): ListedPhoto | null {
  if (!value || typeof value !== "object") return null;
  const photo = value as Partial<ListedPhoto>;
  if (typeof photo.no !== "number" || typeof photo.stage !== "number" || typeof photo.url !== "string" || !isSignedObjectUrl(photo.url)) return null;
  return {
    id: typeof photo.id === "string" ? photo.id : "",
    no: photo.no,
    stage: photo.stage,
    caption: typeof photo.caption === "string" ? photo.caption : null,
    contentType: typeof photo.contentType === "string" ? photo.contentType : "",
    sizeBytes: typeof photo.sizeBytes === "number" ? photo.sizeBytes : 0,
    createdAt: typeof photo.createdAt === "string" ? photo.createdAt : "",
    uploadedAt: typeof photo.uploadedAt === "string" ? photo.uploadedAt : null,
    url: photo.url,
    urlExpiresIn: typeof photo.urlExpiresIn === "number" ? photo.urlExpiresIn : 0,
  };
}

export function toViewPhoto(photo: ListedPhoto): OrderPhoto {
  return {
    id: photo.id,
    no: photo.no,
    at: photo.uploadedAt ?? photo.createdAt,
    caption: photo.caption ?? `Zdjęcie ${photo.no}`,
    stage: STAGE_NAMES[photo.stage - 1] ?? `Etap ${photo.stage}`,
    src: photo.url,
  };
}

export async function listOrderPhotos(studioId: string, workOrderId: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher(ordersUrl(studioId, workOrderId, "/photos"));
  if (!response.ok) throw new OrderMediaError(await errorMessage(response, "Nie udało się pobrać zdjęć."), response.status);
  const body = await response.json().catch(() => null);
  if (!Array.isArray(body)) throw new OrderMediaError("Nieprawidłowa lista zdjęć.");
  return body.flatMap((item) => {
    const photo = parseListedPhoto(item);
    return photo ? [photo] : [];
  });
}

export async function uploadOrderPhoto(input: {
  studioId: string;
  workOrderId: string;
  file: File;
  stage: number;
  fetcher?: typeof fetch;
}) {
  const fetcher = input.fetcher ?? fetch;
  const contentType = photoContentType(input.file);
  if (!contentType) throw new OrderMediaError("Dozwolone formaty: JPEG, PNG, WebP, HEIC.", 400);
  if (input.file.size < 1 || input.file.size > MAX_PHOTO_BYTES) throw new OrderMediaError("Zdjęcie może mieć maksymalnie 20 MB.", 400);
  if (!Number.isInteger(input.stage) || input.stage < 1 || input.stage > 4) throw new OrderMediaError("Etap zdjęcia musi być liczbą od 1 do 4.", 400);

  const caption = input.file.name.replace(/\.[^.]+$/, "").trim().slice(0, 200);
  const reserved = await fetcher(ordersUrl(input.studioId, input.workOrderId, "/photos"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType, sizeBytes: input.file.size, stage: input.stage, ...(caption ? { caption } : {}) }),
  });
  if (!reserved.ok) throw new OrderMediaError(await errorMessage(reserved, "Nie udało się przygotować wgrywania."), reserved.status);
  const ticket = await reserved.json().catch(() => null) as { uploadUrl?: unknown; key?: unknown; headers?: unknown } | null;
  const key = assertStudioKey(input.studioId, ticket?.key);
  if (!ticket || typeof ticket.uploadUrl !== "string" || !isSignedObjectUrl(ticket.uploadUrl)) {
    throw new OrderMediaError("Serwer nie wydał podpisanego adresu wgrywania.");
  }
  const headerType = ticket.headers && typeof ticket.headers === "object" ? (ticket.headers as { "Content-Type"?: unknown })["Content-Type"] : undefined;
  const put = await fetcher(ticket.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": typeof headerType === "string" ? headerType : contentType },
    body: input.file,
  });
  if (!put.ok) throw new OrderMediaError("Magazyn odrzucił plik.", put.status);
  const confirmed = await fetcher(ordersUrl(input.studioId, input.workOrderId, "/photos/confirm"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  if (!confirmed.ok) throw new OrderMediaError(await errorMessage(confirmed, "Nie udało się potwierdzić zdjęcia."), confirmed.status);
  const photo = parseListedPhoto(await confirmed.json().catch(() => null));
  if (!photo) throw new OrderMediaError("Podgląd zdjęcia wymaga podpisanego adresu.");
  return photo;
}

function fraction(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

function parseProtocol(value: unknown): ProtocolRecord {
  if (!value || typeof value !== "object") throw new OrderMediaError("Nieprawidłowa odpowiedź protokołu.");
  const protocol = value as {
    number?: unknown;
    createdAt?: unknown;
    acceptedAt?: unknown;
    createdBy?: { name?: unknown } | null;
    damages?: unknown;
  };
  if (typeof protocol.number !== "string" || typeof protocol.createdAt !== "string" || !Array.isArray(protocol.damages)) {
    throw new OrderMediaError("Nieprawidłowa odpowiedź protokołu.");
  }
  return {
    number: protocol.number,
    createdAt: protocol.createdAt,
    acceptedAt: typeof protocol.acceptedAt === "string" ? protocol.acceptedAt : null,
    createdByName: protocol.createdBy && typeof protocol.createdBy.name === "string" ? protocol.createdBy.name : null,
    damages: protocol.damages.map((item, index) => {
      const damage = item as { no?: unknown; title?: unknown; part?: unknown; size?: unknown; x?: unknown; y?: unknown; photo?: { id?: unknown; no?: unknown } | null };
      const x = fraction(damage.x);
      const y = fraction(damage.y);
      if (typeof damage.title !== "string" || typeof damage.part !== "string" || x === null || y === null) {
        throw new OrderMediaError("Nieprawidłowa odpowiedź protokołu.");
      }
      return {
        no: typeof damage.no === "number" ? damage.no : index + 1,
        title: damage.title,
        part: damage.part,
        size: typeof damage.size === "string" ? damage.size : null,
        x,
        y,
        photoId: damage.photo && typeof damage.photo.id === "string" ? damage.photo.id : undefined,
        photoNo: damage.photo && typeof damage.photo.no === "number" ? damage.photo.no : undefined,
      };
    }),
  };
}

async function sendProtocol(response: Response) {
  if (!response.ok) throw new OrderMediaError(await errorMessage(response, "Nie udało się zapisać protokołu."), response.status);
  return parseProtocol(await response.json().catch(() => null));
}

export async function saveOrderProtocol(studioId: string, workOrderId: string, damages: ProtocolDamageInput[], fetcher: typeof fetch = fetch) {
  if (damages.length > MAX_PROTOCOL_DAMAGES) throw new OrderMediaError("Protokół może mieć najwyżej 30 punktów.", 400);
  const response = await fetcher(ordersUrl(studioId, workOrderId, "/protocol"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ damages }),
  });
  return sendProtocol(response);
}

export async function acceptOrderProtocol(studioId: string, workOrderId: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher(ordersUrl(studioId, workOrderId, "/protocol/accept"), { method: "POST" });
  return sendProtocol(response);
}
