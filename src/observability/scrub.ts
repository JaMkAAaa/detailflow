const REDACTED = "[redacted]";

const SECRET_KEY = /token|password|secret|authorization|cookie|credential|dsn|api[-_]?key|smtp/i;

const SECRET_PATTERNS: RegExp[] = [
  /Bearer\s+\S+/gi,
  /\b(?:ksefTokenEnc|ksefToken|authorization|password|secret|api[_-]?key|token)\b\s*[:=]\s*["']?[^\s"',}]+/gi,
  /\btest:v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+\b/g,
  /\b(?:postgres(?:ql)?|redis|rediss):\/\/[^\s:@/]+:[^\s@/]+@/gi,
];

export function isSecretKey(key: string) {
  return SECRET_KEY.test(key);
}

export function redactString(value: string) {
  let next = value;
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    next = next.replace(pattern, match => {
      if (/:\/\//.test(match)) return match.replace(/:\/\/([^:]+):[^@]+@/, "://$1:[redacted]@");
      return REDACTED;
    });
  }
  return next;
}

export function scrubValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return redactString(value);
  if (typeof value !== "object" || value === null) return value;
  if (value instanceof Error) return sanitizeError(value);
  if (seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) value[index] = scrubValue(value[index], seen);
    return value;
  }
  for (const [key, child] of Object.entries(value)) {
    (value as Record<string, unknown>)[key] = isSecretKey(key) ? REDACTED : scrubValue(child, seen);
  }
  return value;
}

export function scrubSentryEvent<T>(event: T): T {
  scrubValue(event);
  return event;
}

/** Nowy błąd bez pól takich jak `ksefToken`. Treść i stack są czyszczone. */
export function sanitizeError(error: unknown) {
  const name = error instanceof Error && error.name ? redactString(error.name) : "Error";
  const message = error instanceof Error ? redactString(error.message) : "worker failure";
  const safe = new Error(message);
  safe.name = name;
  if (error instanceof Error && error.stack) safe.stack = redactString(error.stack);
  return safe;
}
