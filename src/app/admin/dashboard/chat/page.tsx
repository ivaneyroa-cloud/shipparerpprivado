"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useChat, UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
    Send, Trash2, Loader2, Copy, Check,
    Calculator, Briefcase, FileText, Printer, Download, BookmarkPlus, BookmarkCheck, Ticket
} from 'lucide-react';

// ── Types ──
type Message = {
    id: string;
    role: 'user' | 'bot';
    content: string;
    timestamp: Date;
    invoiceData?: InvoiceData | null;
};

type ChatMode = 'chinese' | 'english' | 'business' | 'converter' | 'invoice';

interface InvoiceItem {
    description: string;
    hs_code?: string;
    material: string;
    purpose: string;
    quantity: number;
    unit_value: number;
}

interface InvoiceData {
    supplier_name: string;
    supplier_address: string;
    buyer_name: string;
    buyer_address: string;
    buyer_zip: string;
    buyer_phone: string;
    items: InvoiceItem[];
    origin: string;
    signature: string;
    date: string;
}

interface TabConfig {
    id: ChatMode;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    placeholder: string;
    welcome: string;
    suggestedPrompts: string[];
}

// ── Tab Configuration ──
const TABS: TabConfig[] = [
    {
        id: 'chinese',
        label: '中文 Chino',
        shortLabel: '中文',
        icon: <span className="text-base leading-none">🇨🇳</span>,
        color: 'text-red-500',
        bgColor: 'bg-red-500',
        placeholder: 'Escribí en español o chino y se traduce automáticamente...',
        welcome: '🇨🇳 **Traductor Chino ↔ Español**\n\nEscribí en **español** y lo traduzco al chino.\nEscribí en **中文** y lo traduzco al español.\n\n💡 Cada traducción incluye una **re-traducción** para que verifiques qué entiende el proveedor.\n\nIdeal para hablar con proveedores por WeChat.',
        suggestedPrompts: ['Decile al proveedor que necesitamos 500 unidades para el 15 de marzo', '请问这个产品可以发到阿根廷吗', 'Preguntale cuánto sale el envío a Buenos Aires']
    },
    {
        id: 'english',
        label: '🇬🇧 Inglés',
        shortLabel: 'EN',
        icon: <span className="text-base leading-none">🇬🇧</span>,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500',
        placeholder: 'Escribí en español o inglés y se traduce automáticamente...',
        welcome: '🇬🇧 **Traductor Inglés ↔ Español**\n\nEscribí en **español** y lo traduzco al inglés comercial.\nEscribí en **english** y lo traduzco al español.\n\n💡 Cada traducción incluye una **re-traducción** para que verifiques el significado.\n\nTono relajado, sin "Dear Sir/Madam".',
        suggestedPrompts: ['Decile que necesitamos la tracking del envío urgente', 'Avisale que el pago fue transferido hoy', 'Preguntale si puede hacer FOB Shanghai']
    },
    {
        id: 'business',
        label: '💼 Gestión',
        shortLabel: '💼',
        icon: <Briefcase size={16} />,
        color: 'text-amber-500',
        bgColor: 'bg-amber-500',
        placeholder: 'Escribí lo que necesitás...',
        welcome: 'Dale, en qué te ayudo?',
        suggestedPrompts: ['¿Cuántos envíos tenemos pendientes de recolección?', 'Redactame un email de seguimiento para un cliente', '¿Qué retenciones hay activas?', 'Calculame el costo de un envío 50kg a Miami']
    },
    {
        id: 'converter',
        label: '📐 Conversiones',
        shortLabel: '📐',
        icon: <Calculator size={16} />,
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-500',
        placeholder: 'Ej: 50x40x30 cm, 25 libras a kg, 3 CBM a pies cúbicos...',
        welcome: '📐 **Calculadora Logística**\n\nTirá las medidas y calculo automáticamente:\n\n📦 **Peso volumétrico** — ej: "50x40x30"\n⚖️ **Libras ↔ Kilos** — ej: "25 libras"\n📏 **Pulgadas ↔ cm** — ej: "12 pulgadas"\n📊 **CBM** — metros cúbicos\n\nSolo escribí los números.',
        suggestedPrompts: ['50x40x30 cm', '25 libras a kg', '3 CBM a pies cúbicos', '120x80x90, 45 kg']
    },
    {
        id: 'invoice',
        label: '📄 Invoice',
        shortLabel: '📄',
        icon: <FileText size={16} />,
        color: 'text-violet-500',
        bgColor: 'bg-violet-500',
        placeholder: 'Describí los datos: proveedor, comprador, productos, cantidades, precios...',
        welcome: '📄 **Generador de Commercial Invoice**\n\nDescribime los datos y genero la factura:\n\n🏭 **Proveedor** — nombre y dirección\n🏢 **Comprador** — nombre, dirección, CUIT\n📦 **Productos** — descripción, cantidad, precio unitario USD\n📋 **Extras** — código HS, material, propósito\n\nEjemplo: *"Haceme una invoice de Guangzhou Seawave para TMCO SRL, 1000 pvc zipper bags a 0.207 USD c/u"*',
        suggestedPrompts: ['Haceme una invoice de proveedor X para TMCO SRL', 'Agregale un producto más a la última invoice', 'Cambiá el precio unitario a 0.15 USD']
    },
];

// ── Invoice Preview Component ──
function InvoicePreview({ data }: { data: InvoiceData }) {
    const total = data.items.reduce((sum, item) => sum + item.quantity * item.unit_value, 0);

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(`
            <!DOCTYPE html>
            <html><head><title>Commercial Invoice - ${data.buyer_name}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Times New Roman', serif; padding: 40px; color: #000; background: #fff; }
                .header { text-align: center; margin-bottom: 30px; }
                .header h1 { font-size: 22px; margin-bottom: 4px; }
                .header p { font-size: 12px; color: #444; }
                .title { text-align: center; font-size: 24px; font-weight: bold; margin: 25px 0; letter-spacing: 2px; }
                .info { margin-bottom: 20px; font-size: 13px; line-height: 1.8; }
                .info strong { font-weight: bold; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
                th, td { border: 1px solid #000; padding: 8px 10px; text-align: center; }
                th { background: #f5f5f5; font-weight: bold; font-size: 11px; }
                td { font-size: 12px; }
                .total-row td { font-weight: bold; }
                .footer { margin-top: 30px; font-size: 13px; line-height: 2; }
                @media print { body { padding: 20px; } }
            </style></head><body>
            <div class="header">
                <h1>${data.supplier_name}</h1>
                <p>${data.supplier_address}</p>
            </div>
            <div class="title">Commercial Invoice</div>
            <div class="info">
                <p><strong>Attn:</strong> ${data.buyer_name}</p>
                <p><strong>Address:</strong> ${data.buyer_address}</p>
                <p><strong>Zip code:</strong> ${data.buyer_zip}</p>
                <p><strong>Phone:</strong> ${data.buyer_phone}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Full Description of Goods</th>
                        <th>HS Code</th>
                        <th>Material</th>
                        <th>Purpose</th>
                        <th>Quantity (pcs)</th>
                        <th>Unit Value (USD)</th>
                        <th>Total Value (USD)</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.items.map((item, i) => `
                        <tr>
                            <td>${i + 1}</td>
                            <td style="text-align:left">${item.description}</td>
                            <td>${item.hs_code || ''}</td>
                            <td>${item.material}</td>
                            <td>${item.purpose}</td>
                            <td>${item.quantity.toLocaleString()}</td>
                            <td>${item.unit_value.toFixed(3)}</td>
                            <td>${(item.quantity * item.unit_value).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                    <tr class="total-row">
                        <td colspan="6"></td>
                        <td><strong>Total (USD)</strong></td>
                        <td><strong>$${total.toFixed(2)}</strong></td>
                    </tr>
                </tbody>
            </table>
            <div class="footer">
                <p><strong>Made in ${data.origin}</strong></p>
                <p style="text-align:center; margin-top:20px"><strong>Signature: ${data.signature}</strong></p>
                <p style="text-align:center"><strong>Date: ${data.date}</strong></p>
            </div>
            </body></html>
        `);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
    };

    return (
        <div className="mt-2">
            {/* Invoice Card */}
            <div className="bg-white text-black rounded-xl overflow-hidden shadow-lg border border-slate-200 max-w-2xl">
                {/* Supplier Header */}
                <div className="text-center py-4 px-6 border-b border-slate-200">
                    <h2 className="text-lg font-bold text-slate-900">{data.supplier_name}</h2>
                    <p className="text-[11px] text-slate-500 mt-1">{data.supplier_address}</p>
                </div>

                {/* Title */}
                <div className="text-center py-3">
                    <h3 className="text-xl font-bold tracking-widest text-slate-800">Commercial Invoice</h3>
                </div>

                {/* Buyer Info */}
                <div className="px-6 py-3 text-xs space-y-1 border-b border-slate-100">
                    <p><span className="font-bold">Attn:</span> {data.buyer_name}</p>
                    <p><span className="font-bold">Address:</span> {data.buyer_address}</p>
                    <p><span className="font-bold">Zip code:</span> {data.buyer_zip}</p>
                    <p><span className="font-bold">Phone:</span> {data.buyer_phone}</p>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                        <thead>
                            <tr className="bg-slate-50">
                                <th className="border border-slate-200 px-2 py-2 font-bold">#</th>
                                <th className="border border-slate-200 px-2 py-2 font-bold text-left">Description</th>
                                <th className="border border-slate-200 px-2 py-2 font-bold">HS Code</th>
                                <th className="border border-slate-200 px-2 py-2 font-bold">Material</th>
                                <th className="border border-slate-200 px-2 py-2 font-bold">Purpose</th>
                                <th className="border border-slate-200 px-2 py-2 font-bold">Qty</th>
                                <th className="border border-slate-200 px-2 py-2 font-bold">Unit (USD)</th>
                                <th className="border border-slate-200 px-2 py-2 font-bold">Total (USD)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.map((item, i) => (
                                <tr key={i}>
                                    <td className="border border-slate-200 px-2 py-2 text-center">{i + 1}</td>
                                    <td className="border border-slate-200 px-2 py-2">{item.description}</td>
                                    <td className="border border-slate-200 px-2 py-2 text-center">{item.hs_code || '-'}</td>
                                    <td className="border border-slate-200 px-2 py-2 text-center">{item.material}</td>
                                    <td className="border border-slate-200 px-2 py-2 text-center">{item.purpose}</td>
                                    <td className="border border-slate-200 px-2 py-2 text-center">{item.quantity.toLocaleString()}</td>
                                    <td className="border border-slate-200 px-2 py-2 text-center">{item.unit_value.toFixed(3)}</td>
                                    <td className="border border-slate-200 px-2 py-2 text-center font-medium">{(item.quantity * item.unit_value).toFixed(2)}</td>
                                </tr>
                            ))}
                            <tr className="bg-slate-50 font-bold">
                                <td colSpan={6} className="border border-slate-200 px-2 py-2"></td>
                                <td className="border border-slate-200 px-2 py-2 text-center text-[10px]">Total (USD)</td>
                                <td className="border border-slate-200 px-2 py-2 text-center text-sm">${total.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 text-xs space-y-2">
                    <p className="font-bold">Made in {data.origin}</p>
                    <p className="text-center font-bold pt-2">Signature: {data.signature}</p>
                    <p className="text-center font-bold">Date: {data.date}</p>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-3">
                <button
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
                >
                    <Printer size={14} />
                    Imprimir / PDF
                </button>
            </div>
        </div>
    );
}

// ── Parse Invoice from AI Response ──
function parseInvoiceFromResponse(content: string): { text: string; invoice: InvoiceData | null } {
    const invoiceMatch = content.match(/:::INVOICE_JSON:::([\s\S]*?):::END_INVOICE:::/);
    if (!invoiceMatch) return { text: content, invoice: null };

    try {
        const invoice = JSON.parse(invoiceMatch[1].trim()) as InvoiceData;
        const text = content.replace(/:::INVOICE_JSON:::[\s\S]*?:::END_INVOICE:::/, '').trim();
        return { text, invoice };
    } catch {
        return { text: content, invoice: null };
    }
}

// ── Chat Panel Component ──
function ChatPanel({ tab, isActive }: { tab: TabConfig; isActive: boolean }) {
    const { messages, sendMessage, status, setMessages } = useChat({
        id: tab.id,
        messages: [{
            id: `welcome-${tab.id}`,
            role: 'assistant',
            parts: [{ type: 'text', text: tab.welcome }],
        }] as UIMessage[],
        transport: new DefaultChatTransport({
            api: '/api/chat',
            body: { mode: tab.id },
            headers: async (): Promise<Record<string, string>> => {
                const { data: { session } } = await supabase.auth.getSession();
                return session?.access_token
                    ? { Authorization: `Bearer ${session.access_token}` }
                    : {};
            }
        })
    });


    const [input, setInput] = useState('');
    const [ticketCreatedIds, setTicketCreatedIds] = useState<Set<string>>(new Set());
    const isLoading = status === 'submitted' || status === 'streaming';

    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [savedId, setSavedId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = useCallback(() => {
        if (isActive) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isActive]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    useEffect(() => {
        if (isActive) inputRef.current?.focus();
    }, [isActive]);

    const clearChat = () => {
        setMessages([{
            id: `welcome-${tab.id}`,
            role: 'assistant',
            parts: [{ type: 'text', text: '💬 Chat limpio. ¿En qué te ayudo?' }]
        } as UIMessage]);
    };

    const copyMessage = (id: string, content: string) => {
        navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const createTicket = async (msgId: string, msgContent: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            // Get last user message as the question
            const userMsgs = messages.filter(m => m.role === 'user');
            const lastUserMsg = userMsgs[userMsgs.length - 1];
            const question = (lastUserMsg?.parts as any[])?.find((p: any) => p.type === 'text')?.text || 'Sin detalle';

            await supabase.from('ai_tickets').insert({
                question,
                ai_response: msgContent.replace('[TICKET_SUGERIDO]', '').trim(),
                created_by: user?.id,
                status: 'pending',
                mode: tab.id,
            });

            setTicketCreatedIds(prev => new Set([...prev, msgId]));
            toast.success('Ticket levantado ✅', { description: 'Ivan lo va a ver en el panel de tickets' });
        } catch {
            toast.error('No se pudo crear el ticket');
        }
    };

    const saveToMemory = async (id: string, content: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const res = await fetch('/api/knowledge', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    content,
                    category: tab.id,
                    // userId & userName now derived from JWT server-side
                }),
            });
            if (res.ok) {
                setSavedId(id);
                setTimeout(() => setSavedId(null), 3000);
            }
        } catch {
            // silently fail
        }
    };

    const renderContent = (text: string) => {
        return text.split('\n').map((line, i) => {
            if (line.trim() === '') return <br key={i} />;
            // Safe renderer: parse **bold** and `code` into React elements (no raw HTML)
            const parts: React.ReactNode[] = [];
            let remaining = line;
            let partKey = 0;
            while (remaining.length > 0) {
                // Match **bold** or `code`
                const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
                const codeMatch = remaining.match(/`(.*?)`/);
                // Find the earliest match
                let earliest: { index: number; length: number; node: React.ReactNode } | null = null;
                if (boldMatch && boldMatch.index !== undefined) {
                    earliest = { index: boldMatch.index, length: boldMatch[0].length, node: <strong key={`b${partKey}`}>{boldMatch[1]}</strong> };
                }
                if (codeMatch && codeMatch.index !== undefined) {
                    if (!earliest || codeMatch.index < earliest.index) {
                        earliest = { index: codeMatch.index, length: codeMatch[0].length, node: <code key={`c${partKey}`} className="bg-slate-700/50 px-1.5 py-0.5 rounded text-blue-300 text-xs">{codeMatch[1]}</code> };
                    }
                }
                if (!earliest) {
                    parts.push(remaining);
                    break;
                }
                if (earliest.index > 0) parts.push(remaining.slice(0, earliest.index));
                parts.push(earliest.node);
                remaining = remaining.slice(earliest.index + earliest.length);
                partKey++;
            }
            return <p key={i} className="mb-1">{parts}</p>;
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const form = e.currentTarget.closest('form');
            if (form) form.requestSubmit();
        }
    };

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        sendMessage({
            text: input.trim()
        });
        setInput('');
        if (inputRef.current) inputRef.current.style.height = 'auto';
    };

    return (
        <div
            style={{ display: isActive ? 'flex' : 'none', backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
            className="flex-1 border rounded-[24px] overflow-hidden flex-col min-h-0 shadow-sm"
        >
            {/* Top bar */}
            <div
                style={{ borderColor: 'var(--card-border)' }}
                className="px-5 py-3 border-b flex items-center justify-between shrink-0"
            >
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${tab.bgColor} ${isLoading ? 'animate-bounce' : 'animate-pulse'}`} />
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                        {tab.label} {isLoading && '- Pensando...'}
                    </span>
                </div>
                <button
                    onClick={clearChat}
                    className="flex items-center gap-1 px-3 py-1.5 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg text-[11px] font-bold transition-colors"
                >
                    <Trash2 size={12} />
                    Limpiar
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
                {/* Suggested Prompts — only shown when chat has just welcome */}
                {messages.length <= 1 && tab.suggestedPrompts.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                        {tab.suggestedPrompts.map((prompt, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    setInput(prompt);
                                    setTimeout(() => {
                                        sendMessage({ text: prompt });
                                        setInput('');
                                    }, 50);
                                }}
                                className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:scale-[1.02] active:scale-95"
                                style={{ background: 'var(--input-bg)', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                )}
                <AnimatePresence initial={false}>
                    {messages.map((msg: UIMessage) => {
                        const isUser = msg.role === 'user';

                        // Extract text from parts array
                        const textParts = msg.parts?.filter((p: any) => p.type === 'text') || [];
                        const msgContent = textParts.map((p: any) => p.text).join('') || '';

                        let invoiceData: InvoiceData | null = null;
                        let displayText = msgContent;

                        // Detect ticket suggestion marker
                        const hasTicketSuggestion = !isUser && msgContent.includes('[TICKET_SUGERIDO]');
                        if (!isUser) displayText = displayText.replace('[TICKET_SUGERIDO]', '').trim();

                        if (tab.id === 'invoice' && !isUser) {
                            const parsed = parseInvoiceFromResponse(msgContent);
                            invoiceData = parsed.invoice;
                            displayText = parsed.text || (invoiceData ? '✅ ¡Invoice generada! Podés imprimirla o descargarla como PDF.' : msgContent);
                        }

                        return (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`group relative ${invoiceData ? 'max-w-[95%]' : 'max-w-[85%]'} ${isUser ? 'order-1' : 'order-0'}`}>
                                    <div
                                        className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${isUser
                                            ? `${tab.bgColor} text-white rounded-br-md shadow-lg`
                                            : 'bg-slate-100 dark:bg-white/5 text-slate-800 dark:text-slate-200 rounded-bl-md border border-slate-200 dark:border-white/10'
                                            }`}
                                    >
                                        {renderContent(displayText)}
                                        {invoiceData && <InvoicePreview data={invoiceData} />}
                                    </div>

                                    {/* Ticket button — shown when AI suggests it */}
                                    {hasTicketSuggestion && !msg.id.startsWith('welcome') && (
                                        <div className="mt-2">
                                            <button
                                                onClick={() => createTicket(msg.id, msgContent)}
                                                disabled={ticketCreatedIds.has(msg.id)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${ticketCreatedIds.has(msg.id)
                                                    ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                                                    : 'bg-amber-500 hover:bg-amber-400 text-white shadow-md hover:shadow-amber-500/30'
                                                    }`}
                                            >
                                                <Ticket size={12} />
                                                {ticketCreatedIds.has(msg.id) ? 'Ticket levantado ✅' : 'Levantar Ticket'}
                                            </button>
                                        </div>
                                    )}

                                    {/* Copy, Save & Report buttons (on hover) */}
                                    {!isUser && !msg.id.startsWith('welcome') && !invoiceData && (
                                        <div className="absolute -bottom-6 left-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-3">
                                            <button
                                                onClick={() => copyMessage(msg.id, msgContent)}
                                                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-blue-500 font-bold"
                                            >
                                                {copiedId === msg.id ? (
                                                    <><Check size={10} /> Copiado</>
                                                ) : (
                                                    <><Copy size={10} /> Copiar</>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => saveToMemory(msg.id, msgContent)}
                                                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-emerald-500 font-bold"
                                            >
                                                {savedId === msg.id ? (
                                                    <><BookmarkCheck size={10} /> ¡Guardado!</>
                                                ) : (
                                                    <><BookmarkPlus size={10} /> Guardar</>
                                                )}
                                            </button>
                                            {/* Manual ticket: user can always report wrong info */}
                                            {!ticketCreatedIds.has(msg.id) && (
                                                <button
                                                    onClick={() => createTicket(msg.id, msgContent)}
                                                    className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-red-500 font-bold"
                                                >
                                                    <Ticket size={10} /> Info incorrecta
                                                </button>
                                            )}
                                        </div>
                                    )}

                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
                <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleFormSubmit} style={{ borderColor: 'var(--card-border)' }} className="px-4 py-3 border-t shrink-0">
                <div className="flex items-end gap-3">
                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={handleInput}
                            onKeyDown={handleKeyDown}
                            placeholder={tab.placeholder}
                            rows={1}
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-blue-500 transition-colors resize-none overflow-hidden text-slate-800 dark:text-white placeholder:text-slate-400"
                            style={{ minHeight: '44px', maxHeight: '120px' }}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className={`${tab.bgColor} hover:opacity-90 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 text-white p-3 rounded-xl transition-all active:scale-95 shrink-0`}
                    >
                        {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                </div>
            </form>
        </div>
    );
}

// ── Main Component ──
export default function ChatPage() {
    const [activeMode, setActiveMode] = useState<ChatMode>('business');

    const businessTab = TABS.find(t => t.id === 'business')!;
    const toolTabs = TABS.filter(t => t.id !== 'business');

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col">
            {/* Header */}
            <div className="mb-4 shrink-0">
                <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">Asistente Shippar</h1>
                <p className="text-slate-500 font-medium text-sm mt-0.5">
                    Traducción, gestión, cálculo e invoices impulsado por IA
                </p>
            </div>

            {/* Tabs — two zones */}
            <div className="flex items-center gap-3 mb-4 shrink-0 overflow-x-auto pb-1 hide-scrollbar">

                {/* PRIMARY: Gestión Operaciones */}
                <button
                    onClick={() => setActiveMode('business')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all whitespace-nowrap border shrink-0
                        ${activeMode === 'business'
                            ? 'bg-amber-500 text-white border-transparent'
                            : 'bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20'
                        }`}
                >
                    <Briefcase size={15} />
                    GESTIÓN OPERACIONES
                </button>

                {/* Divider */}
                <div className="h-6 w-px bg-slate-200 dark:bg-white/10 shrink-0" />

                {/* TOOLS group label */}
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0 hidden sm:block">
                    Herramientas
                </span>

                {/* Tool tabs */}
                {toolTabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveMode(tab.id)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border shrink-0
                            ${activeMode === tab.id
                                ? `${tab.bgColor} text-white shadow-md border-transparent`
                                : 'bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                            }`}
                    >
                        {tab.icon}
                        <span className="hidden sm:inline">{tab.label}</span>
                        <span className="sm:hidden">{tab.shortLabel}</span>
                    </button>
                ))}
            </div>

            {/* Render all Chat Panels, hide inactive ones to preserve state */}
            {TABS.map((tab) => (
                <ChatPanel key={tab.id} tab={tab} isActive={activeMode === tab.id} />
            ))}
        </div>
    );
}
