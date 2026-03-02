// This file is required by Sentry to instrument the Node.js runtime.
// It must be imported before any other module.
// See: https://docs.sentry.io/platforms/javascript/guides/nextjs/

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        await import('../sentry.server.config');
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
        await import('../sentry.edge.config');
    }
}
