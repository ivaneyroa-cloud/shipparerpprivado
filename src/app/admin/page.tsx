"use client";

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, ChevronRight, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function AdminLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<'login' | 'reset' | 'reset-sent'>('login');
    const [resetEmail, setResetEmail] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            window.location.href = '/admin/dashboard';
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
            redirectTo: `${window.location.origin}/admin/reset-password`,
        });

        setLoading(false);

        if (error) {
            setError(error.message);
        } else {
            // Always show success (don't reveal if email exists or not)
            setMode('reset-sent');
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
                        <h1 className="text-3xl font-black text-white tracking-tight">ADMIN <span className="text-blue-500 underline decoration-2 underline-offset-4">PANEL</span></h1>
                        <p className="text-slate-400 mt-2 font-medium text-center">Logística interna y gestión empresarial</p>
                    </div>

                    <AnimatePresence mode="wait">
                        {mode === 'login' && (
                            <motion.form
                                key="login"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                                onSubmit={handleLogin}
                                className="space-y-6"
                            >
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Email Corporativo</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                                        <input
                                            type="email"
                                            required
                                            placeholder="admin@shippar.com"
                                            className="w-full bg-slate-800/50 border border-white/5 focus:border-blue-500/50 outline-none text-white px-12 py-4 rounded-xl transition-all font-medium"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Contraseña</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                                        <input
                                            type="password"
                                            required
                                            placeholder="••••••••"
                                            className="w-full bg-slate-800/50 border border-white/5 focus:border-blue-500/50 outline-none text-white px-12 py-4 rounded-xl transition-all font-medium"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm p-4 rounded-xl font-bold flex items-center gap-2"
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                        {error === 'Invalid login credentials' ? 'Credenciales incorrectas' : error}
                                    </motion.div>
                                )}

                                <button
                                    disabled={loading}
                                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 group active:scale-[0.98] "
                                >
                                    {loading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>INGRESAR AL PANEL <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
                                    )}
                                </button>

                                <div className="text-center">
                                    <button
                                        type="button"
                                        onClick={() => { setMode('reset'); setError(null); setResetEmail(email); }}
                                        className="text-slate-500 hover:text-blue-400 text-xs font-bold transition-colors"
                                    >
                                        ¿Olvidaste tu contraseña?
                                    </button>
                                </div>
                            </motion.form>
                        )}

                        {mode === 'reset' && (
                            <motion.form
                                key="reset"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                onSubmit={handleResetPassword}
                                className="space-y-6"
                            >
                                <div className="text-center mb-2">
                                    <p className="text-white font-bold text-lg">Restablecer contraseña</p>
                                    <p className="text-slate-400 text-sm mt-1">Ingresá el email de tu cuenta y te enviamos un link para crear una nueva contraseña.</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Email de tu cuenta</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                                        <input
                                            type="email"
                                            required
                                            placeholder="tu-email@shippar.net"
                                            className="w-full bg-slate-800/50 border border-white/5 focus:border-blue-500/50 outline-none text-white px-12 py-4 rounded-xl transition-all font-medium"
                                            value={resetEmail}
                                            onChange={(e) => setResetEmail(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm p-4 rounded-xl font-bold flex items-center gap-2"
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
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
                                        <>ENVIAR LINK DE RECUPERACIÓN <Mail className="w-5 h-5" /></>
                                    )}
                                </button>

                                <div className="text-center">
                                    <button
                                        type="button"
                                        onClick={() => { setMode('login'); setError(null); }}
                                        className="text-slate-500 hover:text-blue-400 text-xs font-bold transition-colors flex items-center gap-1 mx-auto"
                                    >
                                        <ArrowLeft size={12} /> Volver al login
                                    </button>
                                </div>
                            </motion.form>
                        )}

                        {mode === 'reset-sent' && (
                            <motion.div
                                key="reset-sent"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.3 }}
                                className="space-y-6 text-center"
                            >
                                <div className="flex justify-center">
                                    <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center">
                                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                                    </div>
                                </div>
                                <div>
                                    <p className="text-white font-bold text-lg">¡Link enviado!</p>
                                    <p className="text-slate-400 text-sm mt-2">
                                        Si el email <span className="text-white font-bold">{resetEmail}</span> está registrado en el sistema, vas a recibir un link para restablecer tu contraseña.
                                    </p>
                                    <p className="text-slate-500 text-xs mt-3">Revisá tu bandeja de entrada y la carpeta de spam.</p>
                                </div>
                                <button
                                    onClick={() => { setMode('login'); setError(null); setResetEmail(''); }}
                                    className="text-blue-400 hover:text-blue-300 text-sm font-bold transition-colors flex items-center gap-1 mx-auto"
                                >
                                    <ArrowLeft size={14} /> Volver al login
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

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
