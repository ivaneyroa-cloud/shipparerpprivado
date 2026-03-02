"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
    Users, Plus, Shield, ShieldCheck, Truck, Receipt, UserCog,
    Mail, Lock, User as UserIcon, X, Loader2, CheckCircle2,
    MoreVertical, Ban, CheckCircle, Eye, EyeOff, Trash2
} from 'lucide-react';

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; description: string }> = {
    super_admin: {
        label: 'Super Admin',
        color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        icon: <ShieldCheck size={14} />,
        description: 'Control absoluto del sistema'
    },
    admin: {
        label: 'Administrador',
        color: 'bg-red-500/10 text-red-500 border-red-500/20',
        icon: <ShieldCheck size={14} />,
        description: 'Acceso total al sistema, gestión de usuarios y auditoría'
    },
    logistics: {
        label: 'Logística',
        color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        icon: <Truck size={14} />,
        description: 'Alta de envíos, carga de cotizaciones, gestión de paquetes'
    },
    sales: {
        label: 'Vendedor',
        color: 'bg-green-500/10 text-green-500 border-green-500/20',
        icon: <UserCog size={14} />,
        description: 'Solo ve los clientes asignados y sus envíos'
    },
    billing: {
        label: 'Facturación',
        color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        icon: <Receipt size={14} />,
        description: 'Acceso a cotizaciones, facturación y cobranzas'
    },
    operator: {
        label: 'Operador',
        color: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
        icon: <Shield size={14} />,
        description: 'Acceso básico de lectura'
    }
};

export default function TeamPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [session, setSession] = useState<any>(null);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        full_name: '',
        role: 'operator'
    });

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    }, []);

    const fetchUsers = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch('/api/users', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            const data = await res.json();
            if (data.users) {
                setUsers(data.users);
            }
        } catch (err) {
            console.error('Error fetching users:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No autorizado');

            const res = await fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(formData)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            toast.success(`Usuario ${formData.full_name} creado exitosamente`);
            setShowAddModal(false);
            setFormData({ email: '', password: '', full_name: '', role: 'operator' });
            fetchUsers();
        } catch (err: any) {
            toast.error(err.message || 'Error al crear usuario');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (userId: string, currentActive: boolean) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch('/api/users', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    userId,
                    updates: { is_active: !currentActive }
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error);
            }

            toast.success(currentActive ? 'Usuario desactivado' : 'Usuario activado');
            fetchUsers();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleChangeRole = async (userId: string, newRole: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch('/api/users', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    userId,
                    updates: { role: newRole }
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error);
            }

            toast.success('Rol actualizado');
            fetchUsers();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleDeleteUser = async (userId: string, userName: string) => {
        if (!confirm(`¿Seguro que querés ELIMINAR a ${userName}? Esta acción no se puede deshacer.`)) return;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch('/api/users', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ userId })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error);
            }

            toast.success(`Usuario ${userName} eliminado`);
            fetchUsers();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleResetPassword = async (userId: string, newPassword: string, userName: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch('/api/users', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    userId,
                    updates: { password: newPassword }
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error);
            }

            toast.success(`Contraseña de ${userName} actualizada`);
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    return (
        <>
            <div className="space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">Gestión de Equipo</h1>
                        <div className="flex items-center gap-3 mt-1">
                            <p className="text-slate-500 font-medium text-sm">Usuarios y control de acceso</p>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <p className="text-slate-500 font-medium text-sm">{users.length} miembros</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-black px-6 py-3.5 rounded-[22px] transition-all active:scale-95  text-sm"
                    >
                        <Plus size={16} strokeWidth={2.5} />
                        NUEVO USUARIO
                    </button>
                </div>

                {/* Roles Summary */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {Object.entries(ROLE_CONFIG).map(([key, config]) => {
                        const count = users.filter(u => u.role === key).length;
                        return (
                            <div
                                key={key}
                                style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                                className="border rounded-[20px] p-4 flex flex-col gap-2"
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.color} border`}>
                                    {config.icon}
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{config.label}</p>
                                <p className="text-2xl font-black">{count}</p>
                            </div>
                        );
                    })}
                </div>

                {/* Users Table */}
                <div style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }} className="border rounded-[24px] overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr style={{ borderColor: 'var(--card-border)' }} className="border-b text-left">
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Usuario</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Email</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Rol</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Estado</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Alta</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="py-20 text-center">
                                            <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
                                        </td>
                                    </tr>
                                ) : users.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-20 text-center text-slate-500 text-sm">
                                            No hay usuarios registrados
                                        </td>
                                    </tr>
                                ) : (
                                    users.map(user => {
                                        const roleConfig = ROLE_CONFIG[user.role] || ROLE_CONFIG.operator;
                                        const isSuperAdmin = user.email === 'ivaneyroa@shippar.net';
                                        const isSelf = session?.user?.id === user.id;
                                        return (
                                            <tr key={user.id} style={{ borderColor: 'var(--card-border)' }} className={`border-b last:border-b-0 hover:bg-blue-500/5 transition-colors ${isSuperAdmin ? 'bg-amber-500/5' : ''}`}>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-800 shrink-0 relative">
                                                            <img
                                                                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || user.email || '?')}&background=2563eb&color=fff&bold=true&size=36`}
                                                                alt=""
                                                            />
                                                        </div>
                                                        <div>
                                                            <span className="font-bold text-sm flex items-center gap-1.5">
                                                                {user.full_name || '—'}
                                                                {isSuperAdmin && <ShieldCheck size={14} className="text-amber-500" />}
                                                                {isSelf && !isSuperAdmin && <span className="text-[10px] text-blue-500 font-medium">(Vos)</span>}
                                                            </span>
                                                            {isSuperAdmin && <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">SUPER ADMIN</span>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-500 font-medium">{user.email || '—'}</td>
                                                <td className="px-6 py-4">
                                                    {isSuperAdmin || isSelf ? (
                                                        <span className={`text-xs font-black px-3 py-1.5 rounded-lg border ${roleConfig.color}`}>
                                                            {roleConfig.label} 🔒
                                                        </span>
                                                    ) : (
                                                        <select
                                                            value={user.role}
                                                            onChange={(e) => handleChangeRole(user.id, e.target.value)}
                                                            className={`text-xs font-black px-3 py-1.5 rounded-lg border cursor-pointer outline-none ${roleConfig.color} bg-transparent`}
                                                        >
                                                            {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                                                                <option key={key} value={key} className="bg-slate-800 text-white">{cfg.label}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${user.is_active !== false ? 'text-green-500' : 'text-red-500'}`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full ${user.is_active !== false ? 'bg-green-500' : 'bg-red-500'}`} />
                                                        {user.is_active !== false ? 'Activo' : 'Inactivo'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                                                    {user.created_at ? new Date(user.created_at).toLocaleDateString('es-AR') : '—'}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {!isSuperAdmin && !isSelf ? (
                                                        <div className="flex items-center gap-1 justify-end">
                                                            <button
                                                                onClick={() => handleToggleActive(user.id, user.is_active !== false)}
                                                                className={`text-xs font-black px-2 py-1.5 rounded-lg transition-colors ${user.is_active !== false
                                                                    ? 'text-red-500 hover:bg-red-500/10'
                                                                    : 'text-green-500 hover:bg-green-500/10'}`}
                                                                title={user.is_active !== false ? 'Desactivar' : 'Activar'}
                                                            >
                                                                {user.is_active !== false ? <Ban size={14} /> : <CheckCircle size={14} />}
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const newPass = prompt(`Nueva contraseña para ${user.full_name || user.email} (mín. 6 caracteres):`);
                                                                    if (newPass && newPass.length >= 6) handleResetPassword(user.id, newPass, user.full_name || user.email);
                                                                    else if (newPass) toast.error('La contraseña debe tener al menos 6 caracteres');
                                                                }}
                                                                className="text-xs font-black px-2 py-1.5 rounded-lg transition-colors text-blue-400 hover:bg-blue-500/10"
                                                                title="Cambiar contraseña"
                                                            >
                                                                <Lock size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteUser(user.id, user.full_name || user.email)}
                                                                className="text-xs font-black px-2 py-1.5 rounded-lg transition-colors text-red-400 hover:bg-red-500/10"
                                                                title="Eliminar usuario"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-500 font-bold">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Add User Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                        onClick={() => setShowAddModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-lg bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-white/10 rounded-[24px] shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-black">Nuevo Usuario</h2>
                                    <p className="text-slate-500 text-xs font-medium mt-0.5">Crear acceso para un miembro del equipo</p>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors">
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleCreateUser} className="p-6 space-y-5">
                                {/* Full Name */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nombre Completo</label>
                                    <div className="relative">
                                        <UserIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            required
                                            placeholder="Dolores García"
                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors"
                                            value={formData.full_name}
                                            onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                {/* Email */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Email Corporativo</label>
                                    <div className="relative">
                                        <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="email"
                                            required
                                            placeholder="dolores@shippar.net"
                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors"
                                            value={formData.email}
                                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                {/* Password */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Contraseña Inicial</label>
                                    <div className="relative">
                                        <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            minLength={6}
                                            placeholder="••••••••"
                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl pl-11 pr-11 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors"
                                            value={formData.password}
                                            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                        />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Role Selection */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Rol del Usuario</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {Object.entries(ROLE_CONFIG).map(([key, config]) => (
                                            <label
                                                key={key}
                                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${formData.role === key
                                                    ? 'border-blue-500 bg-blue-500/5'
                                                    : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'}`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="role"
                                                    value={key}
                                                    checked={formData.role === key}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                                                    className="sr-only"
                                                />
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${config.color} border shrink-0`}>
                                                    {config.icon}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-black">{config.label}</p>
                                                    <p className="text-[10px] text-slate-500 font-medium">{config.description}</p>
                                                </div>
                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${formData.role === key ? 'border-blue-500' : 'border-slate-300 dark:border-white/20'}`}>
                                                    {formData.role === key && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-black py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    {saving ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <CheckCircle2 size={16} />
                                            CREAR USUARIO
                                        </>
                                    )}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
