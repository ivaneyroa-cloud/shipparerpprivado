'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { MessageCircle, MessageSquare, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';

// Dynamic imports to avoid SSR issues with page-level components
const ChatPage = dynamic(() => import('@/app/admin/dashboard/chat/page'), {
    ssr: false,
    loading: () => <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-blue-500" size={28} /></div>
});
const TeamChatPage = dynamic(() => import('@/app/admin/dashboard/team-chat/page'), {
    ssr: false,
    loading: () => <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-emerald-500" size={28} /></div>
});

type CommTab = 'ia' | 'equipo';

export default function ComunicacionPage() {
    const [activeTab, setActiveTab] = useState<CommTab>('ia');
    const [unreadCount, setUnreadCount] = useState(0);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) setUserId(session.user.id);
        });
    }, []);

    // Poll for recent team messages not from current user (unread indicator)
    useEffect(() => {
        if (!userId || activeTab === 'equipo') return;

        const fetchUnread = async () => {
            const since = new Date(Date.now() - 1000 * 60 * 30).toISOString();
            const { count } = await supabase
                .from('team_messages')
                .select('id', { count: 'exact', head: true })
                .neq('user_id', userId)
                .gte('created_at', since);
            setUnreadCount(count || 0);
        };

        fetchUnread();
        const interval = setInterval(fetchUnread, 15000);
        return () => clearInterval(interval);
    }, [userId, activeTab]);

    return (
        <div className="flex flex-col h-full">
            {/* Tab selector */}
            <div className="flex items-center gap-3 mb-5 shrink-0">
                <button
                    onClick={() => setActiveTab('ia')}
                    className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-2xl text-sm font-black transition-all ${activeTab === 'ia'
                        ? 'bg-blue-600 text-white  scale-[1.01]'
                        : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.07]'
                        }`}
                >
                    <MessageCircle size={18} />
                    Asistente IA
                </button>
                <button
                    onClick={() => { setActiveTab('equipo'); setUnreadCount(0); window.dispatchEvent(new Event('shippar_chat_read')); }}
                    className={`relative flex-1 flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-2xl text-sm font-black transition-all ${activeTab === 'equipo'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 scale-[1.01]'
                        : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.07]'
                        }`}
                >
                    <MessageSquare size={18} />
                    Chat Equipo
                    {unreadCount > 0 && activeTab !== 'equipo' && (
                        <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[9px] font-black min-w-[20px] h-5 rounded-full flex items-center justify-center px-1">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Content renders the actual page component */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {activeTab === 'ia' ? <ChatPage /> : <TeamChatPage />}
            </div>
        </div>
    );
}
