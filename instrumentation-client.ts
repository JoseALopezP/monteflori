// instrumentation-client.ts
// Reporte de errores de cliente a Sentry. Sin NEXT_PUBLIC_SENTRY_DSN configurado,
// Sentry.init() no hace nada (no requiere cuenta para desarrollar).

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
