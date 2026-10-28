import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "./src/observability/scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
  tracesSampleRate: 0,
  beforeSend(event) {
    event.tags = { ...event.tags, service: "web" };
    return scrubSentryEvent(event);
  },
  beforeBreadcrumb(breadcrumb) {
    return scrubSentryEvent(breadcrumb);
  },
});
