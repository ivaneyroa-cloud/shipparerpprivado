'use client';

/**
 * Next.js App Router Error Boundary for /admin/dashboard/* routes.
 *
 * Catches server-side rendering errors and unhandled promise rejections
 * that the React ErrorBoundary component cannot catch.
 */
export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="w-16 h-16 mx-auto bg-red-500/10 rounded-2xl flex items-center justify-center">
                    <span className="text-3xl">💥</span>
                </div>

                <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                        Error en el Dashboard
                    </h2>
                    <p className="text-slate-500 text-sm">
                        Hubo un problema al cargar esta sección. Tus datos están seguros.
                    </p>
                </div>

                {process.env.NODE_ENV === 'development' && (
                    <div className="bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-xl p-3 text-left">
                        <p className="text-xs font-mono text-red-600 dark:text-red-400 break-all">
                            {error.message}
                        </p>
                        {error.digest && (
                            <p className="text-[10px] font-mono text-red-400 mt-1">
                                Digest: {error.digest}
                            </p>
                        )}
                    </div>
                )}

                <div className="flex gap-3 justify-center">
                    <button
                        onClick={reset}
                        className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                    >
                        Reintentar
                    </button>
                    <button
                        onClick={() => window.location.href = '/admin/dashboard'}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-black transition-all active:scale-95"
                    >
                        Ir al Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
}
