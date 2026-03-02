"use client";
import React, { useState, useRef } from 'react';
import { Sparkles, Send, Loader2, User, Bot, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    table?: { columns: string[]; rows: any[][] };
}

/** Safe markdown-lite renderer — no dangerouslySetInnerHTML */
function RichText({ content }: { content: string }) {
    return (
        <div className="text-sm leading-relaxed space-y-1">
            {content.split('\n').map((line, li) => {
                const isBullet = line.startsWith('- ');
                const text = isBullet ? line.slice(2) : line;
                // Parse **bold** spans
                const parts = text.split(/(\*\*[^*]+\*\*)/);
                const rendered = parts.map((part, pi) =>
                    part.startsWith('**') && part.endsWith('**')
                        ? <strong key={pi}>{part.slice(2, -2)}</strong>
                        : <span key={pi}>{part}</span>
                );
                return (
                    <p key={li} className={isBullet ? 'pl-3 before:content-["\u2022"] before:mr-1.5' : ''}>
                        {rendered}
                    </p>
                );
            })}
        </div>
    );
}

const SUGGESTED = [
    'Top 5 clientes por KG enviados',
    'Top 10 clientes por revenue',
    '¿Cuántos KG se enviaron en este período?',
    'Retenciones por categoría',
    'Tiempo promedio de tránsito por origen',
    'Categorías con más envíos',
    'Clientes con margen negativo',
    'Anomalías y datos faltantes',
    'Clientes sin envíos en este período',
    'Distribución de envíos por origen',
];

export function ReportsAIChat({ from, to }: { from: string; to: string }) {
    const [messages, setMessages] = useState<Message[]>([{
        role: 'assistant',
        content: `¡Hola! Soy tu analista de operaciones con IA real. Tengo acceso a todos los datos de tus envíos del período **${from} → ${to}**.\n\nPodés preguntarme cualquier cosa en lenguaje natural — analizo los datos reales de Supabase y te respondo con información concreta, sin inventar nada.`,
    }]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    const send = async (text?: string) => {
        const q = (text || input).trim();
        if (!q || loading) return;
        setInput('');

        const userMsg: Message = { role: 'user', content: q };
        setMessages(prev => [...prev, userMsg]);
        setLoading(true);

        // Build history for context (last 6 messages)
        const history = messages.slice(-6).map(m => ({
            role: m.role,
            content: m.content,
        }));

        try {
            // Get auth token for secure API call
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const res = await fetch('/api/erp-chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ question: q, from, to, history }),
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            const disclaimerPrefix = data.unverified
                ? '⚠️ *Respuesta no basada en datos verificados del período.*\n\n'
                : '';
            const reply: Message = {
                role: 'assistant',
                content: disclaimerPrefix + (data.answer || 'No pude generar una respuesta.'),
                table: data.table || undefined,
            };
            setMessages(prev => [...prev, reply]);
        } catch (err: any) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `⚠️ Error al conectar con el análisis: ${err.message}. Revisá que el servidor esté corriendo.`,
            }]);
        }

        setLoading(false);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[24px] overflow-hidden shadow-sm dark:shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10 bg-gradient-to-r from-violet-600/10 to-blue-600/10">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                        <Sparkles size={16} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-white">Preguntale al ERP</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">GPT-4o · function calling · datos reales</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">IA Activa</span>
                </div>
            </div>

            {/* Suggested queries */}
            <div className="px-4 pt-3 flex flex-wrap gap-1.5">
                {SUGGESTED.map(s => (
                    <button key={s} onClick={() => send(s)} disabled={loading}
                        className="text-[10px] font-bold px-3 py-1.5 rounded-full border border-violet-500/20 bg-violet-500/5 text-violet-400 hover:bg-violet-500/15 hover:border-violet-500/40 transition-all disabled:opacity-40">
                        {s}
                    </button>
                ))}
            </div>

            {/* Messages */}
            <div className="h-[480px] overflow-y-auto p-4 space-y-4 mt-2">
                <AnimatePresence initial={false}>
                    {messages.map((m, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>

                            {m.role === 'assistant' && (
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md">
                                    <Bot size={13} className="text-white" />
                                </div>
                            )}

                            <div className={`max-w-[88%] ${m.role === 'user'
                                ? 'bg-blue-600 text-white rounded-[16px] rounded-tr-sm'
                                : 'bg-slate-100 dark:bg-white/[0.06] text-slate-800 dark:text-slate-200 rounded-[16px] rounded-tl-sm border border-slate-200 dark:border-white/5'
                                } px-4 py-3`}>

                                {/* Message text — safe renderer, no dangerouslySetInnerHTML */}
                                <RichText content={m.content} />

                                {/* Inline data table */}
                                {m.table && (
                                    <div className="mt-3 overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
                                        <table className="text-[11px] w-full border-collapse">
                                            <thead>
                                                <tr className="bg-black/5 dark:bg-white/10">
                                                    {m.table.columns.map(c => (
                                                        <th key={c} className="px-3 py-2 font-black uppercase tracking-wider text-left whitespace-nowrap">{c}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {m.table.rows.map((row, ri) => (
                                                    <tr key={ri} className="border-t border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                                        {row.map((cell, ci) => (
                                                            <td key={ci} className="px-3 py-2 whitespace-nowrap">{cell}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {m.role === 'user' && (
                                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <User size={13} className="text-white" />
                                </div>
                            )}
                        </motion.div>
                    ))}

                    {loading && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-md">
                                <Bot size={13} className="text-white" />
                            </div>
                            <div className="bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/5 rounded-[16px] rounded-tl-sm px-4 py-3 flex items-center gap-2">
                                <Loader2 size={14} className="animate-spin text-violet-400" />
                                <span className="text-xs text-slate-400 font-medium">Consultando datos y analizando...</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-4 pb-4 border-t border-slate-100 dark:border-white/10 pt-3">
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-2 focus-within:border-violet-500/50 transition-colors">
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                        placeholder="Ej: ¿Cuáles son los 5 clientes más rentables?"
                        disabled={loading}
                        className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-200 outline-none placeholder:text-slate-400 disabled:opacity-50"
                    />
                    <button onClick={() => send()} disabled={loading || !input.trim()}
                        className="w-8 h-8 rounded-xl bg-violet-600 hover:bg-violet-500 flex items-center justify-center text-white transition-all active:scale-95 disabled:opacity-40 flex-shrink-0 shadow-md shadow-violet-500/20">
                        <Send size={13} />
                    </button>
                </div>
                <p className="text-[10px] text-slate-400 text-center mt-2 font-medium">
                    Responde con datos reales · Período activo: <span className="text-violet-400 font-black">{from} → {to}</span>
                </p>
            </div>
        </div>
    );
}
