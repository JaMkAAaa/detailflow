import pino, { type DestinationStream, type Logger } from "pino";
import { redactString, sanitizeError, scrubValue } from "./scrub";

const REDACT_PATHS = [
  "ksefToken",
  "ksefTokenEnc",
  "token",
  "authorization",
  "password",
  "secret",
  "cookie",
  "*.ksefToken",
  "*.ksefTokenEnc",
  "*.token",
  "*.authorization",
  "*.password",
  "*.secret",
  "*.cookie",
  "*.headers.authorization",
  "*.headers.cookie",
  "*.headers.Authorization",
  "*.headers.Cookie",
];

function scrubArg(arg: unknown) {
  if (typeof arg === "string") return redactString(arg);
  if (arg instanceof Error) return sanitizeError(arg);
  if (typeof arg === "object" && arg) return scrubValue(arg);
  return arg;
}

export function createLogger(destination?: DestinationStream): Logger {
  return pino(
    {
      level: process.env.LOG_LEVEL ?? "info",
      messageKey: "message",
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: label => ({ level: label }) },
      redact: { paths: REDACT_PATHS, censor: "[redacted]" },
      hooks: {
        logMethod(args, method) {
          method.apply(this, args.map(scrubArg) as Parameters<typeof method>);
        },
      },
    },
    // sync omija wątek sonic-boom. Zbundlowany worker nie ma pliku workera pino.
    destination ?? pino.destination({ dest: 1, sync: true }),
  );
}

export const logger = createLogger();
