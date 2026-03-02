import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Performance monitoring — sample 10% of transactions in prod
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Only send errors in production
    enabled: process.env.NODE_ENV === "production",

    // Set environment
    environment: process.env.NODE_ENV,

    // Filter out noisy stuff
    ignoreErrors: [
        // Browser extensions
        "top.GLOBALS",
        // Network errors the user can't control
        "Failed to fetch",
        "NetworkError",
        "Load failed",
        // Auth redirects (not real errors)
        "NEXT_REDIRECT",
    ],

    beforeSend(event: Sentry.ErrorEvent) {
        // Don't send events without stack traces (usually spam)
        if (!event.exception?.values?.[0]?.stacktrace) {
            return null;
        }
        return event;
    },
});
