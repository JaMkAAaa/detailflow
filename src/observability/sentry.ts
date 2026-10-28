import * as Sentry from "@sentry/node";
import { sanitizeError, scrubSentryEvent } from "./scrub";

export function initSentry(service: "web" | "worker") {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || Sentry.getClient()) return;
  Sentry.initWithoutDefaultIntegrations({
    dsn,
    enabled: true,
    environment: process.env.NODE_ENV,
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    includeLocalVariables: false,
    tracesSampleRate: 0,
    integrations: [Sentry.onUncaughtExceptionIntegration(), Sentry.onUnhandledRejectionIntegration()],
    beforeSend(event) {
      event.tags = { ...event.tags, service };
      return scrubSentryEvent(event);
    },
    beforeBreadcrumb(breadcrumb) {
      return scrubSentryEvent(breadcrumb);
    },
  });
  Sentry.setTag("service", service);
}

export async function captureWorkerError(error: unknown, context: { studioId?: string; queue: string }) {
  if (!Sentry.getClient()) return;
  const studioId = context.studioId?.trim();
  Sentry.withScope(scope => {
    scope.setTag("service", "worker");
    scope.setTag("queue", context.queue);
    if (studioId) scope.setTag("studioId", studioId);
    Sentry.captureException(sanitizeError(error));
  });
  await Sentry.flush(2_000);
}

export async function reportControlledWorkerError(studioId: string) {
  if (!studioId.trim()) throw new Error("studioId required");
  const error = new Error("controlled worker failure");
  error.name = "ControlledWorkerError";
  await captureWorkerError(error, { studioId, queue: "controlled" });
}
