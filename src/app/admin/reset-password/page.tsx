"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [sessionReady, setSessionReady] = useState(false);

    useEffect(() => {
        // Supabase automatically handles the token from the URL hash
        // and establishes a session. We just need to wait for it.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setSessionReady(true);
            }
        });

        // Also check if we already have a session (in case event already fired)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) setSessionReady(true);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < 8) {
            setError('La contraseña debe tener al menos 8 caracteres');
            return;
        }
        if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
            setError('Debe incluir al menos una mayúscula y un número');
            return;
        }
        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        setLoading(true);

        const { error } = await supabase.auth.updateUser({ password });

        setLoading(false);

        if (error) {
            setError(error.message);
        } else {
            setSuccess(true);
            // Redirect to dashboard after 3 seconds
            setTimeout(() => {
                window.location.href = '/admin/dashboard';
            }, 3000);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 selection:bg-blue-500/30">
            {/* Decorative background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-400/10 blur-[120px] rounded-full" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md relative z-10"
            >
                <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 p-8 md:p-10 rounded-[32px] shadow-2xl">
                    <div className="flex flex-col items-center mb-10">
                        <img src="/logo-dark.png" alt="Shippar" className="h-14 w-auto mb-6" />
                        <h1 className="text-2xl font-black text-white tracking-tight">Nueva Contraseña</h1>
                        <p className="text-slate-400 mt-2 font-medium text-center text-sm">
                            Elegí una contraseña segura para tu cuenta
                        </p>
                    </div>

                    {success ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="space-y-6 text-center"
                        >
                            <div className="flex justify-center">
                                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                                </div>
                            </div>
                            <div>
                                <p className="text-white font-bold text-lg">¡Contraseña actualizada!</p>
                                <p className="text-slate-400 text-sm mt-2">
                                    Redirigiendo al panel en unos segundos...
                                </p>
                            </div>
                            <Loader2 className="w-5 h-5 animate-spin text-blue-500 mx-auto" />
                        </motion.div>
                    ) : !sessionReady ? (
                        <div className="text-center space-y-4">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
                            <p className="text-slate-400 text-sm">Verificando link de recuperación...</p>
                            <p className="text-slate-500 text-xs">
                                Si tardá mucho, puede que el link haya expirado.{' '}
                                <a href="/admin" className="text-blue-400 hover:text-blue-300 font-bold">
                                    Volver al login
                                </a>
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleReset} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Nueva Contraseña</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                                    <input
                                        type="password"
                                        required
                                        placeholder="Mín. 8 caracteres, 1 mayúscula, 1 número"
                                        className="w-full bg-slate-800/50 border border-white/5 focus:border-blue-500/50 outline-none text-white px-12 py-4 rounded-xl transition-all font-medium"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Confirmar Contraseña</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                                    <input
                                        type="password"
                                        required
                                        placeholder="Repetí la contraseña"
                                        className="w-full bg-slate-800/50 border border-white/5 focus:border-blue-500/50 outline-none text-white px-12 py-4 rounded-xl transition-all font-medium"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Password strength hints */}
                            <div className="space-y-1.5 px-1">
                                <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${password.length >= 8 ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                                    <span className={`text-xs font-bold ${password.length >= 8 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        Mínimo 8 caracteres
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${/[A-Z]/.test(password) ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                                    <span className={`text-xs font-bold ${/[A-Z]/.test(password) ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        Al menos una mayúscula
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${/[0-9]/.test(password) ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                                    <span className={`text-xs font-bold ${/[0-9]/.test(password) ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        Al menos un número
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${password && password === confirmPassword ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                                    <span className={`text-xs font-bold ${password && password === confirmPassword ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        Las contraseñas coinciden
                                    </span>
                                </div>
                            </div>

                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm p-4 rounded-xl font-bold flex items-center gap-2"
                                >
                                    <AlertCircle size={16} />
                                    {error}
                                </motion.div>
                            )}

                            <button
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    'GUARDAR NUEVA CONTRASEÑA'
                                )}
                            </button>
                        </form>
                    )}

                    <div className="mt-8 text-center">
                        <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">
                            Seguridad Shippar v2.0
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
