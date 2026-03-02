"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, X, Bot, Sparkles, User, Loader2 } from 'lucide-react';
import { Shipment } from '@/types';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface AICopilotProps {
    shipments: Shipment[];
}

export function AICopilot({ shipments }: AICopilotProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: '¡Hola! Soy Shippar AI. Puedo ayudarte con el estado de tus paquetes o cualquier duda logística. ¿En qué puedo ayudarte hoy?' }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isTyping) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsTyping(true);

        try {
            // Context simulation for the prompt
            // In a real app, this would call /api/chat or similar
            const context = shipments.map(s =>
                `Shipment ${s.tracking_number}: Status ${s.internal_status}, Origin ${s.origin}, Category ${s.category}`
            ).join('\n');

            // Simulate AI response for now (to be connected to prompt engineering)
            setTimeout(() => {
                const response = "Entiendo. Estoy analizando tus " + shipments.length + " paquetes. Según mi registro, el paquete " + (shipments[0]?.tracking_number || "actual") + " está en estado " + (shipments[0]?.internal_status || "pendiente") + ". ¿Necesitás más detalles?";
                setMessages(prev => [...prev, { role: 'assistant', content: response }]);
                setIsTyping(false);
            }, 1500);

        } catch (error) {
            console.error('Chat error:', error);
            setIsTyping(false);
        }
    };

    return (
        <>
            {/* Toggle Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(true)}
                className="fixed bottom-8 right-8 z-[100] w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center group overflow-hidden"
            >
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-700 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <MessageSquare className="relative z-10" />
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border-2 border-dashed border-white/20 rounded-full scale-125"
                />
            </motion.button>

            {/* Chat Modal */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 100, scale: 0.9, filter: 'blur(20px)' }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: 100, scale: 0.9 }}
                        className="fixed bottom-28 right-8 z-[110] w-full max-w-[400px] h-[600px] bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-6 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                                    <Bot size={20} />
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-900 dark:text-white text-sm">Shippar Copilot</h4>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-[8px]">IA Online</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors text-slate-400"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
                            {messages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600' : 'bg-slate-100 dark:bg-white/10 text-slate-500'}`}>
                                            {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                                        </div>
                                        <div className={`p-4 rounded-2xl text-sm font-medium leading-relaxed ${msg.role === 'user'
                                            ? 'bg-blue-600 text-white rounded-tr-none'
                                            : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 rounded-tl-none'
                                            }`}>
                                            {msg.content}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="flex gap-3 max-w-[85%]">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center">
                                            <Loader2 size={14} className="animate-spin text-slate-400" />
                                        </div>
                                        <div className="p-4 bg-slate-100 dark:bg-white/5 rounded-2xl rounded-tl-none text-slate-400 italic text-xs font-bold">
                                            Analizando tus paquetes...
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleSend} className="p-6 bg-slate-50 dark:bg-white/5 border-t border-slate-200 dark:border-white/10">
                            <div className="relative">
                                <input
                                    className="w-full bg-white dark:bg-slate-800 border-none rounded-2xl pl-5 pr-14 py-4 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20"
                                    placeholder="¿Dónde está mi paquete?"
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                />
                                <button
                                    type="submit"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all active:scale-90"
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
