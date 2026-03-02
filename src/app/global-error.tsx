"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html>
            <body style={{
                backgroundColor: '#0a0a0a',
                color: '#fff',
                fontFamily: '-apple-system, sans-serif',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                margin: 0,
            }}>
                <div style={{ textAlign: 'center', maxWidth: 500, padding: 40 }}>
                    <div style={{
                        width: 64, height: 64,
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderRadius: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 24px',
                        fontSize: 28
                    }}>
                        ⚠️
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>
                        Algo salió mal
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>
                        Se produjo un error inesperado. Nuestro equipo ya fue notificado.
                    </p>
                    <button
                        onClick={() => reset()}
                        style={{
                            backgroundColor: '#2563eb',
                            color: '#fff',
                            border: 'none',
                            padding: '12px 32px',
                            borderRadius: 12,
                            fontSize: 14,
                            fontWeight: 800,
                            cursor: 'pointer',
                        }}
                    >
                        Reintentar
                    </button>
                </div>
            </body>
        </html>
    );
}
