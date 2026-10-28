export function reportWorkerError(error: unknown, context: { studioId?: string; queue: string }) {
  if (!process.env.SENTRY_DSN) return;
  void import("./sentry").then(({ captureWorkerError }) => captureWorkerError(error, context));
}
