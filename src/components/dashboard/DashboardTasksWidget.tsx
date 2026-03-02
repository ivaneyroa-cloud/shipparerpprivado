'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, CheckSquare, Clock, CheckCircle, Send,
    Loader2, AlertTriangle, Flag, User, X
} from 'lucide-react';
import { toast } from 'sonner';

interface DashboardTasksWidgetProps {
    userProfile: any;
    teamMembers: any[];
}

export function DashboardTasksWidget({ userProfile, teamMembers }: DashboardTasksWidgetProps) {
    const [myTasks, setMyTasks] = useState<any[]>([]);
    const [sentTasks, setSentTasks] = useState<any[]>([]);
    const [tasksLoading, setTasksLoading] = useState(true);
    const [showNewTaskModal, setShowNewTaskModal] = useState(false);
    const [newTask, setNewTask] = useState({ title: '', description: '', assignedTo: '', priority: 'media', deadline: '' });
    const [savingTask, setSavingTask] = useState(false);

    const loadMyTasks = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const uid = session.user.id;

        // Tasks assigned TO me (pending / in progress)
        const { data: assigned } = await supabase
            .from('tasks')
            .select('id, title, description, assigned_to, assigned_to_name, assigned_by, assigned_by_name, priority, deadline, status, created_at')
            .eq('assigned_to', uid)
            .neq('status', 'completada')
            .order('deadline', { ascending: true })
            .limit(6);

        // Tasks I SENT to others (not completed)
        const { data: sent } = await supabase
            .from('tasks')
            .select('id, title, description, assigned_to, assigned_to_name, assigned_by, assigned_by_name, priority, deadline, status, created_at')
            .eq('assigned_by', uid)
            .neq('assigned_to', uid)
            .neq('status', 'completada')
            .order('created_at', { ascending: false })
            .limit(6);

        const now = new Date();
        const normalize = (t: any) => ({
            ...t,
            status: t.status !== 'completada' && new Date(t.deadline) < now ? 'vencida' : t.status,
        });

        if (assigned) setMyTasks(assigned.map(normalize));
        if (sent) setSentTasks(sent.map(normalize));
        setTasksLoading(false);
    }, []);

    const handleTaskStatus = async (id: string, status: string) => {
        const updates: any = { status };
        if (status === 'completada') updates.completed_at = new Date().toISOString();
        await supabase.from('tasks').update(updates).eq('id', id);
        loadMyTasks();
    };

    const handleSaveNewTask = async () => {
        if (!newTask.title.trim() || !newTask.assignedTo || !newTask.deadline) {
            toast.error('Completá título, asignatario y fecha límite');
            return;
        }
        setSavingTask(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const assignee = teamMembers.find((m: any) => m.id === newTask.assignedTo);
        const sender = userProfile;

        const { error } = await supabase.from('tasks').insert([{
            title: newTask.title.trim(),
            description: newTask.description.trim(),
            assigned_to: newTask.assignedTo,
            assigned_to_name: assignee?.full_name || assignee?.email || '',
            assigned_by: session.user.id,
            assigned_by_name: sender?.full_name || sender?.email || '',
            priority: newTask.priority,
            deadline: newTask.deadline,
            status: 'pendiente',
        }]);

        setSavingTask(false);
        if (error) { toast.error('Error al crear tarea'); return; }
        toast.success('✅ Tarea enviada');
        setShowNewTaskModal(false);
        setNewTask({ title: '', description: '', assignedTo: '', priority: 'media', deadline: '' });
        loadMyTasks();
    };

    useEffect(() => {
        loadMyTasks();
        const channel = supabase
            .channel('dashboard-tasks')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, loadMyTasks)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [loadMyTasks]);

    return (
        <>
            <div style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }} className="border rounded-[28px] p-6 shadow-sm dark:shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-sm font-black flex items-center gap-2 uppercase tracking-tight">
                        <CheckSquare size={16} className="text-blue-400" />
                        Tareas
                    </h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowNewTaskModal(true)}
                            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-3 py-1.5 rounded-xl transition-all active:scale-95"
                        >
                            <Plus size={12} /> Nueva Tarea
                        </button>
                        <Link href="/admin/dashboard/tasks" className="text-[10px] font-black text-slate-400 hover:text-white transition-colors uppercase tracking-widest">
                            Ver todas →
                        </Link>
                    </div>
                </div>

                {tasksLoading ? (
                    <div className="flex justify-center py-6"><Loader2 className="animate-spin text-blue-400" size={20} /></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Column 1: Tareas Pendientes (assigned to me) */}
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1.5">
                                <Clock size={11} className="text-amber-400" /> Pendientes para Mí
                                {myTasks.length > 0 && <span className="bg-amber-500/20 text-amber-400 text-[9px] px-1.5 py-0.5 rounded-full font-black">{myTasks.length}</span>}
                            </p>
                            {myTasks.length === 0 ? (
                                <div className="flex items-center gap-2 py-3 px-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                                    <CheckCircle size={14} className="text-emerald-400" />
                                    <p className="text-xs text-slate-500">Todo al día 🎉</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {myTasks.map((task: any) => {
                                        const due = new Date(task.deadline);
                                        const diffH = (due.getTime() - Date.now()) / 3600000;
                                        const isOverdue = task.status === 'vencida';
                                        const PCOLOR: Record<string, string> = { urgente: 'text-red-400', alta: 'text-amber-400', media: 'text-blue-400', baja: 'text-slate-400' };
                                        return (
                                            <div key={task.id} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${isOverdue ? 'border-red-500/30 bg-red-500/5' : 'border-white/8 bg-white/[0.03]'
                                                }`}>
                                                <Flag size={11} className={`shrink-0 ${PCOLOR[task.priority] || 'text-slate-400'}`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-xs font-bold truncate ${isOverdue ? 'text-red-300' : 'text-white'}`}>{task.title}</p>
                                                    <p className={`text-[10px] flex items-center gap-1 mt-0.5 ${isOverdue ? 'text-red-400' : 'text-slate-500'}`}>
                                                        {isOverdue ? <AlertTriangle size={9} /> : <Clock size={9} />}
                                                        {isOverdue ? `Venció ${due.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}` : diffH < 24 ? `${Math.ceil(diffH)}h` : due.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleTaskStatus(task.id, task.status === 'pendiente' ? 'en_progreso' : 'completada')}
                                                    className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${task.status === 'pendiente' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                        }`}
                                                >
                                                    {task.status === 'pendiente' ? 'Iniciar' : '✓ Listo'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Column 2: Solicitudes Enviadas (tasks I created) */}
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1.5">
                                <Send size={11} className="text-purple-400" /> Solicitudes Enviadas
                                {sentTasks.length > 0 && <span className="bg-purple-500/20 text-purple-400 text-[9px] px-1.5 py-0.5 rounded-full font-black">{sentTasks.length}</span>}
                            </p>
                            {sentTasks.length === 0 ? (
                                <div className="flex items-center gap-2 py-3 px-3 rounded-xl bg-white/[0.03] border border-white/8">
                                    <p className="text-xs text-slate-500">Ninguna tarea enviada</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {sentTasks.map((task: any) => {
                                        const statusLabel: Record<string, string> = { pendiente: 'Pendiente', en_progreso: 'En progreso', vencida: 'Vencida' };
                                        const statusColor: Record<string, string> = { pendiente: 'text-amber-400', en_progreso: 'text-blue-400', vencida: 'text-red-400' };
                                        return (
                                            <div key={task.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/8 bg-white/[0.03]">
                                                <User size={11} className="text-purple-400 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold truncate text-white">{task.title}</p>
                                                    <p className="text-[10px] text-slate-500 truncate">Para: {task.assigned_to_name}</p>
                                                </div>
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full bg-white/5 ${statusColor[task.status] || 'text-slate-400'}`}>
                                                    {statusLabel[task.status] || task.status}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Modal: Nueva Tarea ── */}
            <AnimatePresence>
                {showNewTaskModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
                            className="bg-[#1c1c1e] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl mx-4"
                        >
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-sm font-black text-white flex items-center gap-2"><CheckSquare size={16} className="text-blue-400" /> Nueva Tarea</h3>
                                <button onClick={() => setShowNewTaskModal(false)} className="p-1.5 rounded-lg hover:bg-white/10">
                                    <X size={16} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="space-y-3">
                                <input
                                    type="text" placeholder="Título de la tarea *"
                                    value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500/50"
                                />
                                <textarea
                                    rows={2} placeholder="Descripción (opcional)"
                                    value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500/50 resize-none"
                                />
                                <select
                                    value={newTask.assignedTo} onChange={e => setNewTask(p => ({ ...p, assignedTo: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-300 outline-none focus:border-blue-500/50 appearance-none"
                                >
                                    <option value="">Asignar a... *</option>
                                    {teamMembers.map((m: any) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
                                </select>
                                <div className="grid grid-cols-2 gap-3">
                                    <select
                                        value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))}
                                        className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-300 outline-none focus:border-blue-500/50"
                                    >
                                        <option value="baja">🟢 Baja</option>
                                        <option value="media">🔵 Media</option>
                                        <option value="alta">🟠 Alta</option>
                                        <option value="urgente">🔴 Urgente</option>
                                    </select>
                                    <input
                                        type="date" value={newTask.deadline}
                                        onChange={e => setNewTask(p => ({ ...p, deadline: e.target.value }))}
                                        className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-300 outline-none focus:border-blue-500/50"
                                    />
                                </div>
                                <button
                                    onClick={handleSaveNewTask} disabled={savingTask}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2"
                                >
                                    {savingTask ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                    {savingTask ? 'Guardando...' : 'Enviar Tarea'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
