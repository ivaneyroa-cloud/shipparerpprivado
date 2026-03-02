"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, CheckCircle2, Clock, AlertTriangle,
    ClipboardList, TrendingUp, Loader2, Ticket, MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';

// ── Extracted components ──
import { Task, TeamMember, Status, STATUS_CONFIG } from '@/components/tasks/taskTypes';
import { TaskCard } from '@/components/tasks/TaskCard';
import { NewTaskModal } from '@/components/tasks/NewTaskModal';

export default function TasksPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [filterStatus, setFilterStatus] = useState<Status | 'todas'>('todas');
    const [filterAssignee, setFilterAssignee] = useState<string>('todas');
    const [view, setView] = useState<'mis-tareas' | 'todas' | 'tickets'>('mis-tareas');

    // AI Tickets state
    const [tickets, setTickets] = useState<any[]>([]);
    const [ticketsLoading, setTicketsLoading] = useState(false);

    // Support ?tab=tickets URL param
    const searchParams = useSearchParams();
    useEffect(() => {
        if (searchParams.get('tab') === 'tickets') setView('tickets');
    }, [searchParams]);

    const loadData = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        setCurrentUser(session.user);

        // Load tasks
        const { data: tasksData } = await supabase
            .from('tasks')
            .select('id, title, description, assigned_to, assigned_to_name, assigned_by, assigned_by_name, priority, status, deadline, completed_at, created_at, photos')
            .order('created_at', { ascending: false });

        if (tasksData) {
            // Auto-mark overdue
            const updated = tasksData.map(t => {
                if (t.status !== 'completada' && new Date(t.deadline) < new Date()) {
                    return { ...t, status: 'vencida' as Status };
                }
                return t;
            });
            setTasks(updated);

            // Silently update overdue in DB
            const overdueIds = tasksData
                .filter(t => t.status !== 'completada' && t.status !== 'vencida' && new Date(t.deadline) < new Date())
                .map(t => t.id);
            if (overdueIds.length > 0) {
                await supabase.from('tasks').update({ status: 'vencida' }).in('id', overdueIds);
            }
        }

        // Load team members from registered users
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        const res = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${currentSession?.access_token}` }
        });
        if (res.ok) {
            const body = await res.json();
            const users = body.users || body; // API returns { users: [...] }
            setTeamMembers((Array.isArray(users) ? users : []).map((u: any) => ({
                id: u.id,
                email: u.email,
                name: u.full_name || u.user_metadata?.name || u.email?.split('@')[0] || u.email,
                role: u.role || u.user_metadata?.role || 'operator',
            })));
        }

        setLoading(false);
    }, []);

    // Load AI tickets
    const loadTickets = useCallback(async () => {
        setTicketsLoading(true);
        const { data, error } = await supabase
            .from('ai_tickets')
            .select('id, question, ai_response, status, user_name, created_at')
            .order('created_at', { ascending: false });
        if (!error && data) setTickets(data);
        setTicketsLoading(false);
    }, []);

    useEffect(() => {
        loadData();
        loadTickets();

        // Realtime updates
        const channel = supabase
            .channel('tasks-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => loadData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_tickets' }, () => loadTickets())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [loadData, loadTickets]);

    const handleResolveTicket = async (id: string) => {
        const { error } = await supabase.from('ai_tickets').update({ status: 'resolved' }).eq('id', id);
        if (error) toast.error('Error al resolver ticket');
        else { toast.success('Ticket resuelto ✅'); loadTickets(); }
    };

    const handleStatusChange = async (id: string, status: Status) => {
        const updates: any = { status };
        if (status === 'completada') updates.completed_at = new Date().toISOString();

        const { error } = await supabase.from('tasks').update(updates).eq('id', id);
        if (error) {
            toast.error('Error al actualizar');
        } else {
            toast.success(status === 'completada' ? '🎉 ¡Tarea completada!' : '⏳ Tarea en progreso');
            loadData();
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar esta tarea?')) return;
        const { error } = await supabase.from('tasks').delete().eq('id', id);
        if (error) toast.error('Error al eliminar');
        else { toast.success('Tarea eliminada'); loadData(); }
    };

    // Filtered tasks
    const filtered = tasks.filter(t => {
        if (view === 'mis-tareas' && currentUser) {
            if (t.assigned_to !== currentUser.id && t.assigned_by !== currentUser.id) return false;
        }
        if (filterStatus !== 'todas' && t.status !== filterStatus) return false;
        if (filterAssignee !== 'todas' && t.assigned_to !== filterAssignee) return false;
        return true;
    });

    // Stats
    const myPending = tasks.filter(t => t.assigned_to === currentUser?.id && t.status === 'pendiente').length;
    const myProgress = tasks.filter(t => t.assigned_to === currentUser?.id && t.status === 'en_progreso').length;
    const myOverdue = tasks.filter(t => t.assigned_to === currentUser?.id && t.status === 'vencida').length;
    const totalCompleted = tasks.filter(t => t.status === 'completada').length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={32} className="animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                        <ClipboardList size={24} className="text-blue-400" />
                        Gestión de Tareas
                    </h1>
                    <p className="text-slate-500 text-sm mt-0.5">Asigná y seguí las tareas del equipo en tiempo real</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-sm font-black transition-all active:scale-95 "
                >
                    <Plus size={16} />
                    Nueva Tarea
                </button>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Mis Pendientes', value: myPending, color: 'text-slate-400', bg: 'bg-slate-400/10', icon: <Clock size={16} /> },
                    { label: 'En Progreso', value: myProgress, color: 'text-blue-400', bg: 'bg-blue-400/10', icon: <TrendingUp size={16} /> },
                    { label: 'Vencidas', value: myOverdue, color: 'text-red-400', bg: 'bg-red-400/10', icon: <AlertTriangle size={16} /> },
                    { label: 'Completadas', value: totalCompleted, color: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: <CheckCircle2 size={16} /> },
                ].map((stat) => (
                    <div key={stat.label} className="bg-white/5 border border-white/8 rounded-2xl p-4 flex items-center gap-3">
                        <div className={`${stat.bg} ${stat.color} p-2 rounded-xl`}>
                            {stat.icon}
                        </div>
                        <div>
                            <p className="text-2xl font-black text-white">{stat.value}</p>
                            <p className="text-[11px] text-slate-500 font-medium">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* View toggle + Filters */}
            <div className="flex flex-wrap items-center gap-3">
                {/* View toggle */}
                <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 gap-1">
                    {(['mis-tareas', 'todas', 'tickets'] as const).map(v => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${view === v
                                ? 'bg-blue-600 text-white shadow'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            {v === 'mis-tareas' && <>📋 Mis Tareas</>}
                            {v === 'todas' && <>👥 Todas</>}
                            {v === 'tickets' && (
                                <>
                                    <Ticket size={12} /> Tickets
                                    {tickets.filter(t => t.status === 'pending').length > 0 && (
                                        <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                                            {tickets.filter(t => t.status === 'pending').length}
                                        </span>
                                    )}
                                </>
                            )}
                        </button>
                    ))}
                </div>

                {/* Status filter */}
                <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value as Status | 'todas')}
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none"
                >
                    <option value="todas" className="bg-[#1c1c1e]">🔍 Todos los estados</option>
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <option key={key} value={key} className="bg-[#1c1c1e]">{cfg.label}</option>
                    ))}
                </select>

                {/* Assignee filter (only in "todas" view) */}
                {view === 'todas' && (
                    <select
                        value={filterAssignee}
                        onChange={e => setFilterAssignee(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none"
                    >
                        <option value="todas" className="bg-[#1c1c1e]">👤 Todos los miembros</option>
                        {teamMembers.map(m => (
                            <option key={m.id} value={m.id} className="bg-[#1c1c1e]">{m.name}</option>
                        ))}
                    </select>
                )}

                <span className="text-xs text-slate-500 ml-auto font-medium">
                    {filtered.length} tarea{filtered.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Tasks Grid or Tickets List */}
            {view === 'tickets' ? (
                // ── Tickets View ──
                <div className="space-y-3">
                    {ticketsLoading ? (
                        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-amber-400" /></div>
                    ) : tickets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mb-4">
                                <Ticket size={28} className="text-slate-600" />
                            </div>
                            <p className="text-slate-400 font-bold">Sin tickets pendientes</p>
                            <p className="text-slate-600 text-sm mt-1">El equipo no ha levantado ningún ticket todavía</p>
                        </div>
                    ) : (
                        tickets.map(ticket => (
                            <motion.div
                                key={ticket.id}
                                layout
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`group relative bg-white/5 border rounded-2xl p-4 transition-all hover:bg-white/[0.07] ${ticket.status === 'pending' ? 'border-amber-500/30' : 'border-white/8 opacity-60'
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${ticket.status === 'pending'
                                                ? 'bg-amber-500/20 text-amber-400'
                                                : 'bg-emerald-500/20 text-emerald-400'
                                                }`}>
                                                {ticket.status === 'pending' ? '⏳ Pendiente' : '✅ Resuelto'}
                                            </span>
                                            <span className="text-[10px] text-slate-500">
                                                {new Date(ticket.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="flex items-start gap-2 mb-2">
                                            <MessageSquare size={13} className="text-blue-400 mt-0.5 shrink-0" />
                                            <p className="text-sm font-bold text-white line-clamp-2">{ticket.question}</p>
                                        </div>
                                        {ticket.ai_response && (
                                            <p className="text-xs text-slate-500 line-clamp-2 pl-5">
                                                IA: {ticket.ai_response.slice(0, 120)}{ticket.ai_response.length > 120 ? '...' : ''}
                                            </p>
                                        )}
                                    </div>
                                    {ticket.status === 'pending' && (
                                        <button
                                            onClick={() => handleResolveTicket(ticket.id)}
                                            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-bold transition-all active:scale-95"
                                        >
                                            <CheckCircle2 size={13} /> Resolver
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mb-4">
                        <ClipboardList size={28} className="text-slate-600" />
                    </div>
                    <p className="text-slate-400 font-bold">Sin tareas para mostrar</p>
                    <p className="text-slate-600 text-sm mt-1">
                        {view === 'mis-tareas' ? 'No tenés tareas asignadas ni creadas' : 'No hay tareas con esos filtros'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <AnimatePresence mode="popLayout">
                        {filtered.map(task => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                currentUserId={currentUser?.id || ''}
                                onStatusChange={handleStatusChange}
                                onDelete={handleDelete}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <NewTaskModal
                        onClose={() => setShowModal(false)}
                        onCreated={loadData}
                        currentUser={currentUser}
                        teamMembers={teamMembers}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
