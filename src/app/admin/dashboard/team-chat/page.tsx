"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Users, Hash, Smile, User } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TeamMessage {
    id: string;
    user_id: string;
    user_name: string;
    user_role: string;
    content: string;
    receiver_id: string | null;
    created_at: string;
}

interface UserProfile {
    id: string;
    full_name: string;
    role: string;
    email?: string;
}

const ROLE_COLORS: Record<string, string> = {
    admin: 'bg-violet-600',
    sales: 'bg-blue-600',
    logistics: 'bg-amber-600',
    billing: 'bg-emerald-600',
    operator: 'bg-rose-600',
};

const ROLE_LABELS: Record<string, string> = {
    admin: 'Admin',
    sales: 'Ventas',
    logistics: 'Logística',
    billing: 'Cobranzas',
    operator: 'Operador',
};

function getInitials(name: string): string {
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function formatDateLabel(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) return 'Hoy';
    if (format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) return 'Ayer';
    return format(date, "EEEE d 'de' MMMM", { locale: es });
}

function groupByDate(messages: TeamMessage[]): Record<string, TeamMessage[]> {
    const groups: Record<string, TeamMessage[]> = {};
    messages.forEach(msg => {
        const key = format(new Date(msg.created_at), 'yyyy-MM-dd');
        if (!groups[key]) groups[key] = [];
        groups[key].push(msg);
    });
    return groups;
}

export default function TeamChatPage() {
    const [allMessages, setAllMessages] = useState<TeamMessage[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
    const [selectedChat, setSelectedChat] = useState<string>('general'); // 'general' or a user_id
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
    const [tableExists, setTableExists] = useState(true);
    const [unreadDMs, setUnreadDMs] = useState<Record<string, number>>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = useCallback((smooth = true) => {
        messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
    }, []);

    // Load current user
    useEffect(() => {
        const loadUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('id, full_name, role')
                    .eq('id', session.user.id)
                    .single();
                if (profile) {
                    setCurrentUser({
                        id: profile.id,
                        full_name: profile.full_name || session.user.email?.split('@')[0] || 'Usuario',
                        role: profile.role || 'admin',
                        email: session.user.email || undefined,
                    });
                }
            }
        };
        loadUser();
    }, []);

    // Load team members
    useEffect(() => {
        const loadTeam = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            try {
                const res = await fetch('/api/users', {
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });
                const data = await res.json();
                if (data.users) {
                    setTeamMembers(data.users.map((u: any) => ({
                        id: u.id,
                        full_name: u.full_name || u.email?.split('@')[0] || '?',
                        role: u.role || 'admin',
                        email: u.email,
                    })));
                }
            } catch (err) {
                console.error('Error loading team:', err);
            }
        };
        loadTeam();
    }, []);

    // Load messages and realtime
    useEffect(() => {
        if (!currentUser) return;

        const fetchMessages = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('team_messages')
                    .select('id, user_id, user_name, user_role, content, receiver_id, created_at')
                    .order('created_at', { ascending: true })
                    .limit(500);

                if (error) {
                    if (error.code === '42P01' || error.message?.includes('does not exist')) {
                        setTableExists(false);
                    }
                    console.error('Error loading messages:', error);
                } else {
                    setAllMessages(data || []);
                    setTableExists(true);
                }
            } catch (err) {
                console.error('Error:', err);
            } finally {
                setLoading(false);
                setTimeout(() => scrollToBottom(false), 100);
            }
        };

        fetchMessages();

        const channel = supabase
            .channel('team-chat')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_messages' }, (payload) => {
                const newMsg = payload.new as TeamMessage;
                setAllMessages(prev => {
                    // If we already have this exact message (by id), skip
                    if (prev.some(m => m.id === newMsg.id)) return prev;
                    // If we have an optimistic version of this message (same user, same content, temp id), replace it
                    const tempIdx = prev.findIndex(m =>
                        m.id.startsWith('temp-') &&
                        m.user_id === newMsg.user_id &&
                        m.content === newMsg.content
                    );
                    if (tempIdx !== -1) {
                        const updated = [...prev];
                        updated[tempIdx] = newMsg;
                        return updated;
                    }
                    return [...prev, newMsg];
                });
                setTimeout(() => scrollToBottom(), 100);
            })
            .subscribe();

        // Presence
        const presenceChannel = supabase.channel('online-users', {
            config: { presence: { key: currentUser.id } }
        });
        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                setOnlineUsers(Object.keys(presenceChannel.presenceState()));
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await presenceChannel.track({ user_id: currentUser.id, user_name: currentUser.full_name });
                }
            });

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(presenceChannel);
        };
    }, [currentUser, scrollToBottom]);

    // Filter messages for the selected chat
    const filteredMessages = allMessages.filter(msg => {
        if (selectedChat === 'general') {
            return !msg.receiver_id;
        }
        // DM: messages between currentUser and selectedChat
        return (
            (msg.user_id === currentUser?.id && msg.receiver_id === selectedChat) ||
            (msg.user_id === selectedChat && msg.receiver_id === currentUser?.id)
        );
    });

    // Calculate unread DMs (messages from others where I haven't opened that chat)
    useEffect(() => {
        if (!currentUser) return;
        const counts: Record<string, number> = {};
        allMessages.forEach(msg => {
            if (msg.receiver_id === currentUser.id && msg.user_id !== selectedChat) {
                counts[msg.user_id] = (counts[msg.user_id] || 0) + 1;
            }
        });
        setUnreadDMs(counts);
    }, [allMessages, currentUser, selectedChat]);

    // Scroll when switching chats
    useEffect(() => {
        setTimeout(() => scrollToBottom(false), 50);
        inputRef.current?.focus();
    }, [selectedChat, scrollToBottom]);

    const sendMessage = async () => {
        const content = input.trim();
        if (!content || sending || !currentUser || !tableExists) return;

        setSending(true);
        setInput('');
        if (inputRef.current) inputRef.current.style.height = 'auto';

        // Optimistic update — show message immediately like WhatsApp
        const tempId = `temp-${Date.now()}`;
        const optimisticMsg: TeamMessage = {
            id: tempId,
            user_id: currentUser.id,
            user_name: currentUser.full_name,
            user_role: currentUser.role,
            content,
            receiver_id: selectedChat !== 'general' ? selectedChat : null,
            created_at: new Date().toISOString(),
        };
        setAllMessages(prev => [...prev, optimisticMsg]);
        setTimeout(() => scrollToBottom(), 50);

        try {
            const insertData: any = {
                user_id: currentUser.id,
                user_name: currentUser.full_name,
                user_role: currentUser.role,
                content,
            };
            if (selectedChat !== 'general') {
                insertData.receiver_id = selectedChat;
            }

            const { data, error } = await supabase.from('team_messages').insert([insertData]).select().single();
            if (error) throw error;

            // Replace optimistic message with the real one from DB
            if (data) {
                setAllMessages(prev => prev.map(m => m.id === tempId ? data : m));
            }
        } catch (err: any) {
            console.error('Error sending:', err);
            // Remove optimistic message on failure
            setAllMessages(prev => prev.filter(m => m.id !== tempId));
            setInput(content); // Restore input
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    };

    const selectedMember = selectedChat !== 'general' ? teamMembers.find(m => m.id === selectedChat) : null;
    const chatTitle = selectedChat === 'general' ? '# General' : selectedMember?.full_name || 'Chat';
    const chatSubtitle = selectedChat === 'general'
        ? `${onlineUsers.length} conectado${onlineUsers.length !== 1 ? 's' : ''}`
        : (ROLE_LABELS[selectedMember?.role || ''] || '');

    const otherMembers = teamMembers.filter(m => m.id !== currentUser?.id);
    const grouped = groupByDate(filteredMessages);

    if (!tableExists) {
        return (
            <div className="h-[calc(100vh-8rem)] flex flex-col items-center justify-center text-center px-6">
                <div className="w-20 h-20 bg-blue-100 dark:bg-blue-500/10 rounded-3xl flex items-center justify-center mb-6">
                    <Users size={32} className="text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-3">Chat de Equipo</h2>
                <p className="text-slate-500 font-medium max-w-md mb-6">
                    Para habilitar el chat, ejecutá este SQL en Supabase:
                </p>
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 max-w-lg w-full text-left">
                    <pre className="text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {`CREATE TABLE team_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT NOT NULL,
  user_role TEXT DEFAULT 'admin',
  content TEXT NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE team_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their messages"
  ON team_messages FOR SELECT TO authenticated
  USING (
    receiver_id IS NULL
    OR user_id = auth.uid()
    OR receiver_id = auth.uid()
  );

CREATE POLICY "Users can insert messages"
  ON team_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime
  ADD TABLE team_messages;`}
                    </pre>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-8rem)] flex gap-4">
            {/* Left Sidebar - Contacts */}
            <div
                style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                className="w-72 border rounded-[24px] flex flex-col overflow-hidden shrink-0 shadow-sm"
            >
                {/* Sidebar Header */}
                <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--card-border)' }}>
                    <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Conversaciones</h2>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                        {onlineUsers.length} en línea
                    </p>
                </div>

                {/* Channel list */}
                <div className="flex-1 overflow-y-auto py-2 px-2">
                    {/* General Channel */}
                    <button
                        onClick={() => setSelectedChat('general')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all mb-1
                            ${selectedChat === 'general'
                                ? 'bg-blue-600 text-white '
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                            }`}
                    >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${selectedChat === 'general' ? 'bg-white/20' : 'bg-blue-50 dark:bg-blue-500/10'}`}>
                            <Hash size={16} className={selectedChat === 'general' ? 'text-white' : 'text-blue-600 dark:text-blue-400'} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-black truncate">General</p>
                            <p className={`text-[10px] font-medium truncate ${selectedChat === 'general' ? 'text-white/60' : 'text-slate-400'}`}>
                                Canal del equipo
                            </p>
                        </div>
                    </button>

                    {/* Separator */}
                    <div className="px-4 py-2 mt-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Mensajes Directos</p>
                    </div>

                    {/* Team Members */}
                    {otherMembers.map(member => {
                        const isOnline = onlineUsers.includes(member.id);
                        const isSelected = selectedChat === member.id;
                        const unread = unreadDMs[member.id] || 0;
                        const roleColor = ROLE_COLORS[member.role] || 'bg-slate-600';

                        return (
                            <button
                                key={member.id}
                                onClick={() => setSelectedChat(member.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all mb-0.5
                                    ${isSelected
                                        ? 'bg-blue-600 text-white '
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                                    }`}
                            >
                                <div className="relative shrink-0">
                                    <div className={`w-9 h-9 ${isSelected ? 'bg-white/20' : roleColor} rounded-xl flex items-center justify-center`}>
                                        <span className="text-white text-[10px] font-black">{getInitials(member.full_name)}</span>
                                    </div>
                                    {isOnline && (
                                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black truncate">{member.full_name}</p>
                                    <p className={`text-[10px] font-medium ${isSelected ? 'text-white/60' : 'text-slate-400'}`}>
                                        {ROLE_LABELS[member.role] || member.role}
                                    </p>
                                </div>
                                {unread > 0 && !isSelected && (
                                    <span className="bg-red-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                                        {unread}
                                    </span>
                                )}
                            </button>
                        );
                    })}

                    {otherMembers.length === 0 && (
                        <p className="px-4 py-6 text-xs text-slate-400 font-medium text-center">
                            No hay otros miembros del equipo registrados aún
                        </p>
                    )}
                </div>
            </div>

            {/* Right: Chat Area */}
            <div
                style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                className="flex-1 border rounded-[24px] overflow-hidden flex flex-col min-h-0 shadow-sm"
            >
                {/* Chat Header */}
                <div
                    style={{ borderColor: 'var(--card-border)' }}
                    className="px-5 py-3 border-b flex items-center gap-3 shrink-0"
                >
                    {selectedChat === 'general' ? (
                        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
                            <Hash size={16} className="text-white" />
                        </div>
                    ) : (
                        <div className={`w-9 h-9 ${ROLE_COLORS[selectedMember?.role || ''] || 'bg-slate-600'} rounded-xl flex items-center justify-center shadow-md`}>
                            <span className="text-white text-[10px] font-black">{getInitials(selectedMember?.full_name || '?')}</span>
                        </div>
                    )}
                    <div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-white">{chatTitle}</h3>
                        <p className="text-[10px] font-bold text-emerald-500 flex items-center gap-1.5">
                            {selectedChat === 'general' ? (
                                <>
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                    {chatSubtitle}
                                </>
                            ) : (
                                <>
                                    {onlineUsers.includes(selectedChat) ? (
                                        <><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> En línea</>
                                    ) : (
                                        <span className="text-slate-400">{chatSubtitle}</span>
                                    )}
                                </>
                            )}
                        </p>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1 min-h-0">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 size={24} className="animate-spin text-slate-400" />
                        </div>
                    ) : filteredMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center mb-4">
                                {selectedChat === 'general' ? <Hash size={28} className="text-blue-500" /> : <User size={28} className="text-blue-500" />}
                            </div>
                            <p className="text-slate-500 font-bold text-sm">
                                {selectedChat === 'general' ? '¡Empezá la conversación del equipo!' : `Escribile a ${selectedMember?.full_name}`}
                            </p>
                            <p className="text-slate-400 text-xs mt-1">Los mensajes se sincronizan en tiempo real</p>
                        </div>
                    ) : (
                        Object.entries(grouped).map(([dateKey, dayMessages]) => (
                            <div key={dateKey}>
                                <div className="flex items-center gap-3 my-4">
                                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-800">
                                        {formatDateLabel(dateKey)}
                                    </span>
                                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                                </div>

                                {dayMessages.map((msg, idx) => {
                                    const isOwn = msg.user_id === currentUser?.id;
                                    const showAvatar = idx === 0 || dayMessages[idx - 1]?.user_id !== msg.user_id;
                                    const isLastInGroup = idx === dayMessages.length - 1 || dayMessages[idx + 1]?.user_id !== msg.user_id;
                                    const roleColor = ROLE_COLORS[msg.user_role] || 'bg-slate-600';

                                    return (
                                        <motion.div
                                            key={msg.id}
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.15 }}
                                            className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''} ${showAvatar ? 'mt-3' : 'mt-0.5'}`}
                                        >
                                            <div className="w-8 shrink-0">
                                                {showAvatar && !isOwn ? (
                                                    <div className={`w-8 h-8 ${roleColor} rounded-xl flex items-center justify-center shadow-md`}>
                                                        <span className="text-white text-[10px] font-black">{getInitials(msg.user_name)}</span>
                                                    </div>
                                                ) : null}
                                            </div>
                                            <div className={`max-w-[70%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                                                {showAvatar && (
                                                    <div className={`flex items-center gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
                                                        <span className="text-[11px] font-black text-slate-600 dark:text-slate-300">
                                                            {isOwn ? 'Vos' : msg.user_name}
                                                        </span>
                                                        {selectedChat === 'general' && (
                                                            <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${roleColor} text-white`}>
                                                                {ROLE_LABELS[msg.user_role] || msg.user_role}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                <div className={`px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words
                                                    ${isOwn
                                                        ? `bg-blue-600 text-white ${isLastInGroup ? 'rounded-2xl rounded-br-md' : 'rounded-2xl'}`
                                                        : `bg-slate-100 dark:bg-white/5 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10 ${isLastInGroup ? 'rounded-2xl rounded-bl-md' : 'rounded-2xl'}`
                                                    }`}
                                                >
                                                    {msg.content}
                                                </div>
                                                {isLastInGroup && (
                                                    <span className={`text-[10px] text-slate-400 mt-0.5 ${isOwn ? 'text-right' : ''}`}>
                                                        {format(new Date(msg.created_at), 'HH:mm')}
                                                    </span>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div style={{ borderColor: 'var(--card-border)' }} className="px-4 py-3 border-t shrink-0">
                    <div className="flex items-end gap-3">
                        <div className="flex-1 relative">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={handleTextareaInput}
                                onKeyDown={handleKeyDown}
                                placeholder={selectedChat === 'general' ? 'Escribí al canal general...' : `Mensaje para ${selectedMember?.full_name || ''}...`}
                                rows={1}
                                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-blue-500 transition-colors resize-none overflow-hidden text-slate-800 dark:text-white placeholder:text-slate-400"
                                style={{ minHeight: '44px', maxHeight: '120px' }}
                            />
                        </div>
                        <button
                            onClick={sendMessage}
                            disabled={!input.trim() || sending}
                            className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 text-white p-3 rounded-xl transition-all active:scale-95 shrink-0 "
                        >
                            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
