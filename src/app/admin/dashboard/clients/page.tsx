"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Plus, Search, UserPlus, MoreVertical, User,
    TrendingUp, X, UserCog, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// ── Extracted components ──
import { AddClientModal } from '@/components/clients/AddClientModal';
import { ClientDetailModal } from '@/components/clients/ClientDetailModal';

export default function ClientsPage() {
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [assigningVendor, setAssigningVendor] = useState<string | null>(null);
    const [savingAssignment, setSavingAssignment] = useState(false);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [sortOrder, setSortOrder] = useState<'name' | 'code'>('name');
    const [viewClient, setViewClient] = useState<any>(null);

    const fetchClients = async (profile?: any) => {
        setLoading(true);
        const currentProfile = profile || userProfile;

        let query = supabase.from('clients').select('id, name, code, assigned_to, cuit, address, tax_condition, service_type, phone, email, created_at, org_id').order('name', { ascending: true });

        // Sales users only see their assigned clients
        if (currentProfile?.role === 'sales') {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                query = query.eq('assigned_to', session.user.id);
            }
        }

        const { data } = await query;
        if (data) setClients(data);
        setLoading(false);
    };

    const fetchTeamMembers = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch('/api/users', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            const data = await res.json();
            if (data.users) {
                setTeamMembers(data.users);
            }
        } catch (err) {
            console.error('Error fetching team:', err);
        }
    };

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('id, role, org_id, is_active, full_name, email')
                    .eq('id', session.user.id)
                    .single();
                if (profile) {
                    setUserProfile(profile);
                    fetchClients(profile);
                }
            }
            fetchTeamMembers();
        };
        init();
    }, []);

    const handleAssignVendor = async (clientId: string, vendorId: string | null) => {
        setSavingAssignment(true);
        const { error } = await supabase
            .from('clients')
            .update({ assigned_to: vendorId })
            .eq('id', clientId);

        if (!error) {
            toast.success(vendorId ? 'Vendedor asignado' : 'Vendedor desasignado');
            fetchClients();
        } else {
            toast.error(error.message);
        }
        setSavingAssignment(false);
        setAssigningVendor(null);
        setOpenMenuId(null);
    };

    const getVendorName = (vendorId: string | null) => {
        if (!vendorId) return null;
        const member = teamMembers.find(m => m.id === vendorId);
        return member?.full_name || member?.email || null;
    };

    const salesMembers = teamMembers.filter(m => m.role === 'sales' || m.role === 'admin');

    const filteredClients = clients
        .filter((c: any) =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.code || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a: any, b: any) => {
            if (sortOrder === 'name') {
                return a.name.localeCompare(b.name);
            } else {
                const numA = parseInt((a.code || '').replace(/\D/g, '')) || 0;
                const numB = parseInt((b.code || '').replace(/\D/g, '')) || 0;
                return numA - numB;
            }
        });

    // Close menu on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            setOpenMenuId(null);
            setAssigningVendor(null);
        };
        if (openMenuId || assigningVendor) {
            document.addEventListener('click', handler);
            return () => document.removeEventListener('click', handler);
        }
    }, [openMenuId, assigningVendor]);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight dark:text-white uppercase tracking-tighter lowercase">base de clientes</h1>
                    <p className="text-slate-500 font-bold dark:text-cyan-600/60 uppercase text-[9px] tracking-[0.2em] mt-1">Gestioná tu cartera de clientes y códigos SH</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-black px-6 py-3 rounded-xl transition-all  active:scale-95 flex items-center gap-2 text-[10px] uppercase tracking-widest"
                >
                    <Plus size={14} strokeWidth={1.5} />
                    AGREGAR CLIENTE
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="erp-card p-5">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#2E7BFF]/10 flex items-center justify-center">
                            <User size={14} className="text-[#2E7BFF]" />
                        </div>
                        <div>
                            <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Total Clientes</p>
                            <p className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>{clients.length}</p>
                        </div>
                    </div>
                </div>
                <div className="erp-card p-5">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                            <UserCog size={14} className="text-[#10B981]" />
                        </div>
                        <div>
                            <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Con Vendedor</p>
                            <p className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>{clients.filter(c => c.assigned_to).length}</p>
                        </div>
                    </div>
                </div>
                <div className="erp-card p-5">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#FFB020]/10 flex items-center justify-center">
                            <UserPlus size={14} className="text-[#FFB020]" />
                        </div>
                        <div>
                            <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Sin Vendedor</p>
                            <p className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>{clients.filter(c => !c.assigned_to).length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Client Table */}
            <div className="erp-card overflow-hidden">
                <div className="px-5 py-3 flex gap-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <div className="relative group flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors" size={14} style={{ color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Buscar cliente por nombre o código..."
                            className="erp-input pl-9 text-xs"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center border rounded-lg overflow-hidden" style={{ borderColor: 'var(--card-border)' }}>
                        <button onClick={() => setSortOrder('name')} className={`px-3 py-2 text-[9px] font-bold uppercase tracking-wider transition-all ${sortOrder === 'name' ? 'bg-[#2E7BFF] text-white' : 'hover:bg-white/[0.03]'}`} style={sortOrder !== 'name' ? { color: 'var(--text-muted)' } : undefined}>A → Z</button>
                        <div className="w-px h-5" style={{ background: 'var(--card-border)' }} />
                        <button onClick={() => setSortOrder('code')} className={`px-3 py-2 text-[9px] font-bold uppercase tracking-wider transition-all ${sortOrder === 'code' ? 'bg-[#2E7BFF] text-white' : 'hover:bg-white/[0.03]'}`} style={sortOrder !== 'code' ? { color: 'var(--text-muted)' } : undefined}>SH #</button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="erp-table">
                        <thead>
                            <tr>
                                <th>Cliente</th>
                                <th>Código</th>
                                <th>Vendedor</th>
                                <th>Teléfono</th>
                                <th>Email</th>
                                <th className="text-center w-40">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-20 text-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
                            ) : filteredClients.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-bold text-sm">No se encontraron clientes</td></tr>
                            ) : (
                                filteredClients.map((client: any) => {
                                    const vendorName = getVendorName(client.assigned_to);
                                    return (
                                        <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group relative">
                                            <td className="px-5 py-3"><span className="font-black text-sm text-slate-800 dark:text-white uppercase tracking-tight">{client.name}</span></td>
                                            <td className="px-5 py-3"><span className="font-mono text-xs font-black text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400 px-2.5 py-1 rounded-lg">{client.code}</span></td>
                                            <td className="px-5 py-3">
                                                {vendorName ? (
                                                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"><UserCog size={11} /> {vendorName}</span>
                                                ) : (
                                                    <span className="text-xs font-bold text-slate-400">Sin vendedor</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3"><span className="text-xs font-bold text-slate-500">{client.phone || '—'}</span></td>
                                            <td className="px-5 py-3"><span className="text-xs font-bold text-slate-500 truncate max-w-[180px] block">{client.email || '—'}</span></td>
                                            <td className="px-5 py-3 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => setViewClient(client)} className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all">Ver</button>
                                                    <div className="relative">
                                                        <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === client.id ? null : client.id); setAssigningVendor(null); }} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                                                            <MoreVertical size={14} className="text-slate-400" />
                                                        </button>
                                                        <AnimatePresence>
                                                            {openMenuId === client.id && (
                                                                <motion.div initial={{ opacity: 0, scale: 0.95, y: -5 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -5 }}
                                                                    className="absolute top-full right-0 mt-1 w-56 bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl z-50 py-1 overflow-hidden"
                                                                    onClick={(e) => e.stopPropagation()}>
                                                                    <button onClick={() => { setAssigningVendor(client.id); }} className="w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-slate-700 dark:text-slate-300 transition-colors">
                                                                        <UserCog size={14} className="text-blue-500" /> Asignar Vendedor
                                                                    </button>
                                                                    {client.assigned_to && (
                                                                        <button onClick={() => handleAssignVendor(client.id, null)} className="w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 transition-colors">
                                                                            <X size={14} /> Quitar Vendedor
                                                                        </button>
                                                                    )}
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                        <AnimatePresence>
                                                            {assigningVendor === client.id && (
                                                                <motion.div initial={{ opacity: 0, scale: 0.95, y: -5 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -5 }}
                                                                    className="absolute top-full right-0 mt-1 w-64 bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                                                                    onClick={(e) => e.stopPropagation()}>
                                                                    <div className="px-4 py-2.5 border-b border-slate-200 dark:border-white/10">
                                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Seleccionar Vendedor</p>
                                                                    </div>
                                                                    <div className="max-h-48 overflow-y-auto py-1">
                                                                        {salesMembers.length === 0 ? (
                                                                            <p className="px-4 py-3 text-xs text-slate-400 font-medium">No hay vendedores</p>
                                                                        ) : salesMembers.map(member => (
                                                                            <button key={member.id} onClick={() => handleAssignVendor(client.id, member.id)} disabled={savingAssignment}
                                                                                className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-3 transition-colors ${client.assigned_to === member.id ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600' : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'}`}>
                                                                                <span className="truncate flex-1">{member.full_name || member.email}</span>
                                                                                {client.assigned_to === member.id && <Check size={14} className="text-blue-500 shrink-0" />}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Client Modal */}
            <AddClientModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onCreated={() => fetchClients()}
                salesMembers={salesMembers}
            />

            {/* View/Edit Client Modal */}
            <ClientDetailModal
                client={viewClient}
                onClose={() => setViewClient(null)}
                onSaved={() => fetchClients()}
                getVendorName={getVendorName}
            />
        </div>
    );
}
