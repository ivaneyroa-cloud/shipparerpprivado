// Shared types and config for the tasks feature
export type Priority = 'baja' | 'media' | 'alta' | 'urgente';
export type Status = 'pendiente' | 'en_progreso' | 'completada' | 'vencida';

export interface Task {
    id: string;
    title: string;
    description?: string;
    assigned_to: string;
    assigned_to_name: string;
    assigned_by: string;
    assigned_by_name: string;
    priority: Priority;
    status: Status;
    deadline: string;
    completed_at?: string;
    created_at: string;
    photos?: string[];
}

export interface TeamMember {
    id: string;
    email: string;
    name: string;
    role: string;
}

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; icon: string }> = {
    baja: { label: 'Baja', color: 'text-slate-400', bg: 'bg-slate-400/10 border-slate-400/20', icon: '🟢' },
    media: { label: 'Media', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', icon: '🔵' },
    alta: { label: 'Alta', color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20', icon: '🟡' },
    urgente: { label: 'Urgente', color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20', icon: '🔴' },
};

export const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string }> = {
    pendiente: { label: 'Pendiente', color: 'text-slate-400', bg: 'bg-slate-400/10' },
    en_progreso: { label: 'En Progreso', color: 'text-blue-400', bg: 'bg-blue-400/10' },
    completada: { label: 'Completada', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    vencida: { label: 'Vencida', color: 'text-red-400', bg: 'bg-red-400/10' },
};

export function formatDeadline(deadline: string): { text: string; isOverdue: boolean; isUrgent: boolean } {
    const now = new Date();
    const due = new Date(deadline);
    const diffMs = due.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffMs < 0) return { text: `Venció hace ${Math.abs(Math.ceil(diffDays))}d`, isOverdue: true, isUrgent: false };
    if (diffHours < 24) return { text: `Vence en ${Math.ceil(diffHours)}h`, isOverdue: false, isUrgent: true };
    if (diffDays < 3) return { text: `Vence en ${Math.ceil(diffDays)}d`, isOverdue: false, isUrgent: true };
    return {
        text: due.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }),
        isOverdue: false,
        isUrgent: false
    };
}
