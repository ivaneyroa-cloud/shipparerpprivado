"use client";

import React from 'react';
import { motion } from 'framer-motion';
import {
    Package,
    LayoutDashboard,
    MessageSquare,
    Settings,
    LogOut,
    User
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function PortalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    const navItems = [
        { icon: <LayoutDashboard size={20} />, label: 'Mis Envíos', href: '/portal/dashboard' },
        { icon: <MessageSquare size={20} />, label: 'Soporte IA', href: '/portal/chat' },
        { icon: <Settings size={20} />, label: 'Configuración', href: '/portal/settings' },
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex font-sans">
            {/* Sidebar */}
            <aside className="w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-white/5 flex flex-col hidden lg:flex">
                <div className="p-8">
                    <img src="/logo.png" alt="Shippar" className="h-8 w-auto mb-10" />

                    <nav className="space-y-2">
                        {navItems.map((item) => (
                            <a
                                key={item.href}
                                href={item.href}
                                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-all hover:text-blue-600 group"
                            >
                                <span className="group-hover:scale-110 transition-transform">{item.icon}</span>
                                {item.label}
                            </a>
                        ))}
                    </nav>
                </div>

                <div className="mt-auto p-8 border-t border-slate-200 dark:border-white/5">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                            <User size={20} />
                        </div>
                        <div className="truncate">
                            <p className="text-sm font-black dark:text-white truncate">Mi Cuenta</p>
                            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Cliente Premium</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-500/5 transition-all"
                    >
                        <LogOut size={20} />
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Header Mobile */}
                <header className="lg:hidden h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-6 shrink-0">
                    <img src="/logo.png" alt="Shippar" className="h-6 w-auto" />
                    <button className="p-2 text-slate-500"><Package size={24} /></button>
                </header>

                <div className="flex-1 overflow-y-auto p-6 lg:p-12 relative">
                    {children}
                </div>
            </main>
        </div>
    );
}
