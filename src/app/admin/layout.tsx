"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Toaster } from 'sonner';
import {
    LayoutDashboard,
    Package,
    Users,
    UsersRound,
    BarChart3,
    Settings,
    LogOut,
    Moon,
    Sun,
    Bell,
    Plane,
    Radio,
    DollarSign,
    Box,
    X,
    Menu,
    TrendingUp,
    Shield,
    CheckSquare,
    Activity
} from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useActiveTimeTracker } from '@/hooks/useActiveTimeTracker';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [userRole, setUserRole] = useState<string>('admin'); // Default to admin, will update on profile load
    const router = useRouter();
    const pathname = usePathname();

    // Track real active time (clicks, keys, scroll — not idle)
    useActiveTimeTracker();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (!session && pathname !== '/admin') {
                router.push('/admin');
            } else if (session) {
                supabase.from('profiles').select('role').eq('id', session.user.id).single()
                    .then(({ data }) => {
                        if (data?.role) setUserRole(data.role);
                    });
            }
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (!session && pathname !== '/admin') {
                router.push('/admin');
            } else if (session) {
                supabase.from('profiles').select('role').eq('id', session.user.id).single()
                    .then(({ data }) => {
                        if (data?.role) setUserRole(data.role);
                    });
            }
        });

        return () => subscription.unsubscribe();
    }, [router, pathname]);

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            document.body.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
            document.body.classList.remove('dark');
        }
    }, [isDarkMode]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    // Si estamos en la página de login, no mostramos el layout
    if (pathname === '/admin') return <>{children}</>;

    // Role-based menu: each item specifies which roles can see it
    const allMenuItems = [
        { icon: <LayoutDashboard size={18} strokeWidth={1.5} />, label: 'Dashboard', href: '/admin/dashboard', roles: ['admin', 'logistics', 'sales', 'billing', 'operator'] },
        { icon: <Package size={18} strokeWidth={1.5} />, label: 'Envíos', href: '/admin/dashboard/shipments', roles: ['admin', 'logistics', 'sales', 'billing'] },
        { icon: <Box size={18} strokeWidth={1.5} />, label: 'Depósito', href: '/admin/dashboard/deposito', roles: ['admin', 'logistics', 'operator', 'billing'] },
        { icon: <Activity size={18} strokeWidth={1.5} />, label: 'Operaciones', href: '/admin/dashboard/operations', roles: ['admin', 'logistics', 'operator'] },
        { icon: <Shield size={18} strokeWidth={1.5} />, label: 'Gerencia', href: '/admin/dashboard/gerencia', roles: ['admin'] },
        { icon: <DollarSign size={18} strokeWidth={1.5} />, label: 'Cobranzas', href: '/admin/dashboard/cobranzas', roles: ['admin', 'billing'] },
        { icon: <TrendingUp size={18} strokeWidth={1.5} />, label: 'Finanzas', href: '/admin/dashboard/finanzas', roles: ['admin', 'billing'] },

        { icon: <Users size={18} strokeWidth={1.5} />, label: 'Clientes', href: '/admin/dashboard/clients', roles: ['admin', 'logistics', 'sales'] },
        { icon: <BarChart3 size={18} strokeWidth={1.5} />, label: 'Reportes', href: '/admin/dashboard/reports', roles: ['admin'] },
        { icon: <Radio size={18} strokeWidth={1.5} />, label: 'Comunicación', href: '/admin/dashboard/comunicacion', roles: ['admin', 'logistics', 'sales', 'billing', 'operator'] },
        { icon: <UsersRound size={18} strokeWidth={1.5} />, label: 'Equipo', href: '/admin/dashboard/team', roles: ['admin'] },
        { icon: <Settings size={18} strokeWidth={1.5} />, label: 'Ajustes', href: '/admin/dashboard/settings', roles: ['admin', 'logistics'] },
    ];

    const menuItems = allMenuItems.filter(item => item.roles.includes(userRole));

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/admin');
    };

    return (
        <div className={`min-h-screen flex ${isDarkMode ? 'dark' : ''}`} style={{ backgroundColor: isDarkMode ? '#0B0F17' : '#F4F6FA', color: isDarkMode ? '#F0F4F8' : '#1a1f36' }}>
            <div className="erp-noise" />
            <Toaster position="bottom-right" theme={isDarkMode ? 'dark' : 'light'} />

            {/* Mobile backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-72 transition-transform duration-300 transform
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                ${isDarkMode ? 'bg-[#0D1117]/95 backdrop-blur-xl border-r border-white/[0.06]' : 'bg-white/95 backdrop-blur-xl border-r border-slate-200/80'}
                lg:relative lg:translate-x-0
            `}>
                <div className="h-full flex flex-col p-6">
                    <div className="flex items-center gap-2.5 mb-10 px-2 relative group cursor-pointer transition-transform active:scale-95">
                        <div className="absolute -inset-3 bg-blue-600/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <img src={isDarkMode ? '/logo-dark.png' : '/logo.png'} alt="Shippar" className="h-8 w-auto relative z-10" />
                    </div>

                    <nav className="flex-1 space-y-3 mt-4">
                        {menuItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    onClick={() => {
                                        // Auto-close sidebar on mobile after navigation
                                        if (window.innerWidth < 1024) setSidebarOpen(false);
                                    }}
                                    className={`
                        group relative flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-[13px] transition-all duration-250
                                        ${isActive
                                            ? 'text-white bg-gradient-to-r from-blue-600/20 to-blue-500/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]'
                                            : isDarkMode ? 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                                        }
                                    `}
                                >
                                    {/* Active Indicator Glow */}
                                    {isActive && (
                                        <div className="absolute left-0 w-[3px] h-5 bg-[#2E7BFF] rounded-full shadow-[0_0_12px_rgba(46,123,255,0.7)]" />
                                    )}

                                    <span className={`${isActive ? 'text-[#2E7BFF]' : isDarkMode ? 'text-slate-500 group-hover:text-slate-300' : 'text-slate-400 group-hover:text-slate-700'} transition-colors duration-250`}>
                                        {item.icon}
                                    </span>
                                    {item.label}

                                    {/* Hover Glow Background */}
                                    {!isActive && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/0 to-blue-500/0 group-hover:from-blue-500/5 transition-all duration-500 rounded-2xl" />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    <button
                        onClick={handleLogout}
                        className={`
                mt-auto flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all
                ${isDarkMode ? 'text-slate-500 hover:bg-red-500/10 hover:text-red-500' : 'text-slate-400 hover:bg-red-50 hover:text-red-600'}
            `}
                    >
                        <LogOut size={18} strokeWidth={1.5} />
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                {/* Topbar */}
                <header className={`
          h-14 md:h-16 flex items-center justify-between px-4 md:px-8 sticky top-0 z-40
          ${isDarkMode ? 'bg-[#0B0F17]/70 backdrop-blur-xl border-b border-white/[0.04]' : 'bg-[#F4F6FA]/80 backdrop-blur-xl border-b border-slate-200/60'}
        `}>
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-slate-400">
                        {sidebarOpen ? <X /> : <Menu />}
                    </button>

                    <div className="flex items-center gap-4 ml-auto">
                        <button
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            className={`p-2.5 rounded-xl transition-all ${isDarkMode ? 'bg-white/5 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500'}`}
                        >
                            {isDarkMode ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
                        </button>
                        <div className={`w-10 h-10 rounded-xl overflow-hidden shadow-inner ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                            <img
                                src={`https://ui-avatars.com/api/?name=${session?.user?.email}&background=2563eb&color=fff&bold=true`}
                                alt="Avatar"
                            />
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-3 md:p-6 lg:p-8 overflow-y-auto relative z-10 erp-bg-depth">
                    <ErrorBoundary>
                        {children}
                    </ErrorBoundary>
                </main>
            </div>
        </div>
    );
}
