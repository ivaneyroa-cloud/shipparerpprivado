'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
    /** Optional fallback component — if not provided, default crash screen is shown */
    fallback?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Global Error Boundary.
 *
 * Catches unhandled JS errors in the React component tree
 * and shows a recovery screen instead of a blank white page.
 *
 * Does NOT catch:
 * - Event handler errors (those need try/catch)
 * - Async errors (those need .catch())
 * - Server-side errors (those need error.tsx in Next.js App Router)
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({ errorInfo });
        // Log to console — in production you'd send this to Sentry, Datadog, etc.
        console.error('[ErrorBoundary] Uncaught error:', error);
        console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
                    <div className="max-w-lg w-full text-center space-y-6">
                        {/* Icon */}
                        <div className="w-20 h-20 mx-auto bg-red-500/10 rounded-3xl flex items-center justify-center">
                            <span className="text-4xl">⚠️</span>
                        </div>

                        {/* Title */}
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
                                Algo salió mal
                            </h1>
                            <p className="text-slate-500 text-sm font-medium">
                                Ocurrió un error inesperado. Tus datos están seguros.
                            </p>
                        </div>

                        {/* Error detail (dev-only) */}
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-2xl p-4 text-left overflow-auto max-h-48">
                                <p className="text-xs font-mono text-red-600 dark:text-red-400 break-all">
                                    {this.state.error.message}
                                </p>
                                {this.state.errorInfo?.componentStack && (
                                    <pre className="text-[10px] font-mono text-red-400 mt-2 whitespace-pre-wrap">
                                        {this.state.errorInfo.componentStack.slice(0, 500)}
                                    </pre>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleReset}
                                className="px-6 py-3 rounded-2xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                            >
                                Intentar de nuevo
                            </button>
                            <button
                                onClick={this.handleReload}
                                className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-black transition-all active:scale-95 "
                            >
                                Recargar página
                            </button>
                        </div>

                        {/* Footer */}
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            Si el problema persiste, contactá al equipo técnico
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
