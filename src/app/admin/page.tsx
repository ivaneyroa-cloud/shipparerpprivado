"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, Loader2, ArrowLeft, CheckCircle2, Eye, EyeOff, ShieldCheck } from 'lucide-react';

// ── Network Nodes Background ──
function NetworkBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationId: number;
        const nodes: { x: number; y: number; vx: number; vy: number }[] = [];
        const NODE_COUNT = 9;
        const CONNECTION_DIST = 220;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        // Initialize nodes
        for (let i = 0; i < NODE_COUNT; i++) {
            nodes.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.15,
                vy: (Math.random() - 0.5) * 0.15,
            });
        }

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw connections
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const dx = nodes[i].x - nodes[j].x;
                    const dy = nodes[i].y - nodes[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < CONNECTION_DIST) {
                        const alpha = (1 - dist / CONNECTION_DIST) * 0.08;
                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(100, 140, 255, ${alpha})`;
                        ctx.lineWidth = 0.6;
                        ctx.moveTo(nodes[i].x, nodes[i].y);
                        ctx.lineTo(nodes[j].x, nodes[j].y);
                        ctx.stroke();
                    }
                }
            }

            // Draw nodes
            for (const node of nodes) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, 2, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(100, 140, 255, 0.15)';
                ctx.fill();

                // Update position
                node.x += node.vx;
                node.y += node.vy;

                // Bounce off edges
                if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
                if (node.y < 0 || node.y > canvas.height) node.vy *= -1;
            }

            animationId = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none"
            style={{ zIndex: 0 }}
        />
    );
}

export default function AdminLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [mode, setMode] = useState<'login' | 'reset' | 'reset-sent'>('login');
    const [resetEmail, setResetEmail] = useState('');
    const [shake, setShake] = useState(false);
    const emailRef = useRef<HTMLInputElement>(null);

    // Autofocus email
    useEffect(() => {
        emailRef.current?.focus();
    }, [mode]);

    const isFormValid = email.trim() !== '' && password.trim() !== '';

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setError(error.message === 'Invalid login credentials' ? 'Credenciales incorrectas' : error.message);
            setLoading(false);
            // Trigger shake
            setShake(true);
            setTimeout(() => setShake(false), 500);
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
            setMode('reset-sent');
        }
    };

    return (
        <div className="min-h-screen bg-[#060a14] flex items-center justify-center p-6 selection:bg-blue-500/30 overflow-hidden">
            {/* Animated gradient background */}
            <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
                <div
                    className="absolute w-[600px] h-[600px] rounded-full blur-[160px] opacity-[0.07]"
                    style={{
                        background: 'linear-gradient(135deg, #2563eb, #3b82f6, #1d4ed8)',
                        top: '-5%',
                        left: '-5%',
                        animation: 'gradientDrift 28s ease-in-out infinite alternate',
                    }}
                />
                <div
                    className="absolute w-[500px] h-[500px] rounded-full blur-[140px] opacity-[0.05]"
                    style={{
                        background: 'linear-gradient(225deg, #1e40af, #3b82f6)',
                        bottom: '-8%',
                        right: '-8%',
                        animation: 'gradientDrift2 32s ease-in-out infinite alternate',
                    }}
                />
            </div>

            {/* Network nodes */}
            <NetworkBackground />

            <style>{`
                @keyframes gradientDrift {
                    0% { transform: translate(0, 0) scale(1); }
                    50% { transform: translate(40px, 30px) scale(1.08); }
                    100% { transform: translate(-20px, 50px) scale(0.95); }
                }
                @keyframes gradientDrift2 {
                    0% { transform: translate(0, 0) scale(1); }
                    50% { transform: translate(-30px, -40px) scale(1.1); }
                    100% { transform: translate(20px, -20px) scale(0.97); }
                }
                @keyframes shakeX {
                    0%, 100% { transform: translateX(0); }
                    10%, 50%, 90% { transform: translateX(-4px); }
                    30%, 70% { transform: translateX(4px); }
                }
                .shake { animation: shakeX 0.4s ease-in-out; }
            `}</style>

            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="w-full max-w-[400px] relative z-10"
            >
                <div className={`bg-[#0c1221]/70 backdrop-blur-2xl border border-white/[0.06] p-8 md:p-10 rounded-[28px] shadow-2xl shadow-black/40 ${shake ? 'shake' : ''}`}>
                    {/* Logo only */}
                    <div className="flex flex-col items-center mb-10">
                        <img src="/logo-dark.png" alt="Shippar" className="h-12 w-auto" />
                    </div>

                    <AnimatePresence mode="wait">
                        {/* ── LOGIN FORM ── */}
                        {mode === 'login' && (
                            <motion.form
                                key="login"
                                initial={{ opacity: 0, x: -16 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 16 }}
                                transition={{ duration: 0.2 }}
                                onSubmit={handleLogin}
                                className="space-y-5"
                            >
                                {/* Email */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Email</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-600 group-focus-within:text-blue-500 transition-colors duration-200" />
                                        <input
                                            ref={emailRef}
                                            type="email"
                                            required
                                            autoComplete="email"
                                            tabIndex={1}
                                            placeholder="usuario@shippar.com"
                                            className={`w-full bg-white/[0.03] border outline-none text-white px-11 py-3.5 rounded-xl transition-all duration-200 font-medium text-sm
                                                ${error ? 'border-red-500/40' : 'border-white/[0.06] focus:border-blue-500/40 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.08)]'}
                                            `}
                                            value={email}
                                            onChange={(e) => { setEmail(e.target.value); setError(null); }}
                                        />
                                    </div>
                                </div>

                                {/* Password */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Contraseña</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-600 group-focus-within:text-blue-500 transition-colors duration-200" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            autoComplete="current-password"
                                            tabIndex={2}
                                            placeholder="••••••••"
                                            className={`w-full bg-white/[0.03] border outline-none text-white px-11 py-3.5 rounded-xl transition-all duration-200 font-medium text-sm pr-12
                                                ${error ? 'border-red-500/40' : 'border-white/[0.06] focus:border-blue-500/40 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.08)]'}
                                            `}
                                            value={password}
                                            onChange={(e) => { setPassword(e.target.value); setError(null); }}
                                        />
                                        <button
                                            type="button"
                                            tabIndex={-1}
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-600 hover:text-slate-400 transition-colors"
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Error */}
                                <AnimatePresence>
                                    {error && (
                                        <motion.p
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="text-red-400 text-xs font-bold pl-1"
                                        >
                                            {error}
                                        </motion.p>
                                    )}
                                </AnimatePresence>

                                {/* Submit Button */}
                                <div className="relative pt-1">
                                    {/* Glow */}
                                    <div
                                        className="absolute inset-0 bg-blue-600/20 blur-2xl rounded-3xl transition-opacity duration-500"
                                        style={{ opacity: isFormValid && !loading ? 0.6 : 0 }}
                                    />
                                    <button
                                        disabled={!isFormValid || loading}
                                        tabIndex={3}
                                        className="relative w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white font-black py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] text-sm tracking-wide"
                                    >
                                        {loading ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" /> Validando…</>
                                        ) : (
                                            'INGRESAR'
                                        )}
                                    </button>
                                </div>

                                {/* Forgot password link */}
                                <div className="text-center pt-1">
                                    <button
                                        type="button"
                                        tabIndex={4}
                                        onClick={() => { setMode('reset'); setError(null); setResetEmail(email); }}
                                        className="text-slate-600 hover:text-blue-400 text-xs font-medium transition-colors duration-200"
                                    >
                                        ¿Olvidaste tu contraseña?
                                    </button>
                                </div>
                            </motion.form>
                        )}

                        {/* ── RESET FORM ── */}
                        {mode === 'reset' && (
                            <motion.form
                                key="reset"
                                initial={{ opacity: 0, x: 16 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -16 }}
                                transition={{ duration: 0.2 }}
                                onSubmit={handleResetPassword}
                                className="space-y-5"
                            >
                                <div className="text-center mb-1">
                                    <p className="text-white font-bold text-base">Restablecer contraseña</p>
                                    <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">Ingresá el email de tu cuenta y te enviamos un link seguro.</p>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Email de tu cuenta</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-600 group-focus-within:text-blue-500 transition-colors duration-200" />
                                        <input
                                            type="email"
                                            required
                                            autoFocus
                                            placeholder="tu-email@shippar.net"
                                            className="w-full bg-white/[0.03] border border-white/[0.06] focus:border-blue-500/40 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.08)] outline-none text-white px-11 py-3.5 rounded-xl transition-all duration-200 font-medium text-sm"
                                            value={resetEmail}
                                            onChange={(e) => setResetEmail(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <p className="text-red-400 text-xs font-bold pl-1">{error}</p>
                                )}

                                <button
                                    disabled={loading || !resetEmail.trim()}
                                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] text-sm tracking-wide"
                                >
                                    {loading ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</>
                                    ) : (
                                        'ENVIAR LINK'
                                    )}
                                </button>

                                <div className="text-center">
                                    <button
                                        type="button"
                                        onClick={() => { setMode('login'); setError(null); }}
                                        className="text-slate-600 hover:text-blue-400 text-xs font-medium transition-colors duration-200 flex items-center gap-1 mx-auto"
                                    >
                                        <ArrowLeft size={12} /> Volver
                                    </button>
                                </div>
                            </motion.form>
                        )}

                        {/* ── RESET SENT ── */}
                        {mode === 'reset-sent' && (
                            <motion.div
                                key="reset-sent"
                                initial={{ opacity: 0, scale: 0.96 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.3 }}
                                className="space-y-5 text-center"
                            >
                                <div className="flex justify-center">
                                    <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/15 rounded-full flex items-center justify-center">
                                        <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                                    </div>
                                </div>
                                <div>
                                    <p className="text-white font-bold text-base">Link enviado</p>
                                    <p className="text-slate-500 text-xs mt-2 leading-relaxed">
                                        Si <span className="text-slate-300 font-semibold">{resetEmail}</span> está registrado, vas a recibir un email con instrucciones.
                                    </p>
                                    <p className="text-slate-600 text-[10px] mt-2">Revisá spam si no lo encontrás.</p>
                                </div>
                                <button
                                    onClick={() => { setMode('login'); setError(null); setResetEmail(''); }}
                                    className="text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors flex items-center gap-1 mx-auto"
                                >
                                    <ArrowLeft size={12} /> Volver al login
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Footer */}
                    <div className="mt-8 flex items-center justify-center gap-1.5">
                        <ShieldCheck size={12} className="text-slate-700" />
                        <p className="text-slate-700 text-[10px] font-medium tracking-wide">
                            Conexión segura
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
