'use client';

import { motion } from 'framer-motion';
import { Flag, User, Calendar, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { Task, Status, PRIORITY_CONFIG, STATUS_CONFIG, formatDeadline } from './taskTypes';

interface TaskCardProps {
    task: Task;
    currentUserId: string;
    onStatusChange: (id: string, status: Status) => void;
    onDelete: (id: string) => void;
}

export function TaskCard({ task, currentUserId, onStatusChange, onDelete }: TaskCardProps) {
    const deadline = formatDeadline(task.deadline);
    const pConfig = PRIORITY_CONFIG[task.priority];
    const sConfig = STATUS_CONFIG[task.status];
    const isAssignee = currentUserId === task.assigned_to;
    const isCreator = currentUserId === task.assigned_by;
    const isOverdue = task.status !== 'completada' && new Date(task.deadline) < new Date();

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`group relative bg-white/5 border rounded-2xl p-4 transition-all hover:bg-white/[0.07] ${isOverdue ? 'border-red-500/30 shadow-red-500/5 shadow-lg' : 'border-white/8'
                }`}
        >
            {/* Overdue bar */}
            {isOverdue && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 to-orange-500 rounded-t-2xl" />
            )}

            {/* Top row */}
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${pConfig.bg} ${pConfig.color}`}>
                            <Flag size={9} />
                            {pConfig.label}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${sConfig.bg} ${sConfig.color}`}>
                            {sConfig.label}
                        </span>
                    </div>
                    <h3 className="font-bold text-white text-sm leading-tight">{task.title}</h3>
                    {task.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{task.description}</p>
                    )}
                </div>

                {/* Delete (only creator) */}
                {isCreator && task.status !== 'completada' && (
                    <button
                        onClick={() => onDelete(task.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/10 rounded-lg transition-all text-slate-600 hover:text-red-400"
                    >
                        <Trash2 size={13} />
                    </button>
                )}
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                <span className="flex items-center gap-1">
                    <User size={11} />
                    <span className="font-medium text-slate-400">{task.assigned_to_name}</span>
                </span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1">
                    <Calendar size={11} />
                    <span className={`font-medium ${deadline.isOverdue ? 'text-red-400' : deadline.isUrgent ? 'text-amber-400' : 'text-slate-400'}`}>
                        {deadline.text}
                    </span>
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-500">de {task.assigned_by_name}</span>
            </div>

            {/* Photos gallery */}
            {task.photos && task.photos.length > 0 && (
                <div className="mb-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">📸 {task.photos.length} foto{task.photos.length > 1 ? 's' : ''}</p>
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {task.photos.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                <img
                                    src={url}
                                    alt={`foto-${i + 1}`}
                                    className="w-14 h-14 object-cover rounded-lg border border-white/10 hover:border-blue-500/50 hover:scale-105 transition-all flex-shrink-0 cursor-zoom-in"
                                />
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* Actions (only assignee) */}
            {isAssignee && task.status !== 'completada' && (
                <div className="flex gap-2">
                    {task.status === 'pendiente' && (
                        <button
                            onClick={() => onStatusChange(task.id, 'en_progreso')}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-xs font-bold transition-all active:scale-95"
                        >
                            <Clock size={12} />
                            Iniciar
                        </button>
                    )}
                    {task.status === 'en_progreso' && (
                        <button
                            onClick={() => onStatusChange(task.id, 'completada')}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-bold transition-all active:scale-95"
                        >
                            <CheckCircle2 size={12} />
                            Marcar Completada
                        </button>
                    )}
                    {task.status === 'pendiente' && (
                        <button
                            onClick={() => onStatusChange(task.id, 'completada')}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-bold transition-all"
                        >
                            <CheckCircle2 size={12} />
                        </button>
                    )}
                </div>
            )}

            {task.status === 'completada' && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                    <CheckCircle2 size={13} />
                    Completada {task.completed_at ? new Date(task.completed_at).toLocaleDateString('es-AR') : ''}
                </div>
            )}
        </motion.div>
    );
}
