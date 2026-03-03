'use client';

import React, { useState } from 'react';
import { BaseModal } from '@/components/ui/BaseModal';
import { Plus, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Priority, TeamMember, PRIORITY_CONFIG } from './taskTypes';

interface NewTaskModalProps {
    onClose: () => void;
    onCreated: () => void;
    currentUser: any;
    teamMembers: TeamMember[];
}

export function NewTaskModal({ onClose, onCreated, currentUser, teamMembers }: NewTaskModalProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [assignedTo, setAssignedTo] = useState('');
    const [priority, setPriority] = useState<Priority>('media');
    const [deadline, setDeadline] = useState('');
    const [saving, setSaving] = useState(false);
    const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
    const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []).slice(0, 30);
        setSelectedPhotos(files);
        const previews = files.map(f => URL.createObjectURL(f));
        setPhotoPreviews(previews);
    };

    const removePhoto = (idx: number) => {
        setSelectedPhotos(prev => prev.filter((_, i) => i !== idx));
        setPhotoPreviews(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !assignedTo || !deadline) {
            toast.error('Completá al menos título, destinatario y fecha límite');
            return;
        }

        setSaving(true);
        const member = teamMembers.find(m => m.id === assignedTo);

        // 1. Insert task first to get its ID
        const { data: created, error } = await supabase.from('tasks').insert([{
            title,
            description,
            assigned_to: assignedTo,
            assigned_to_name: member?.name || member?.email || 'Usuario',
            assigned_by: currentUser.id,
            assigned_by_name: currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'Vos',
            priority,
            status: 'pendiente',
            deadline: new Date(deadline).toISOString(),
        }]).select('id').single();

        if (error || !created) {
            toast.error('Error al crear la tarea');
            setSaving(false);
            return;
        }

        // 2. Upload photos if any
        if (selectedPhotos.length > 0) {
            const uploadedUrls: string[] = [];
            for (const file of selectedPhotos) {
                const ext = file.name.split('.').pop();
                const path = `tasks/${created.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
                const { error: uploadErr } = await supabase.storage.from('task-photos').upload(path, file);
                if (!uploadErr) {
                    const { data: urlData } = supabase.storage.from('task-photos').getPublicUrl(path);
                    uploadedUrls.push(urlData.publicUrl);
                }
            }
            if (uploadedUrls.length > 0) {
                await supabase.from('tasks').update({ photos: uploadedUrls }).eq('id', created.id);
            }
        }

        toast.success(`✅ Tarea asignada correctamente${selectedPhotos.length > 0 ? ` con ${selectedPhotos.length} foto${selectedPhotos.length > 1 ? 's' : ''}` : ''}`);
        onCreated();
        onClose();
        setSaving(false);
    };

    const minDate = new Date();
    minDate.setMinutes(minDate.getMinutes() + 30);
    const minDateStr = minDate.toISOString().slice(0, 16);

    return (
        <BaseModal isOpen={true} onClose={onClose} size="lg" zIndex={50}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
                <div>
                    <h2 className="text-lg font-black text-white">Nueva Tarea</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Asignala a un integrante del equipo</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                    <X size={16} className="text-slate-400" />
                </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Title */}
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Título *</label>
                    <input
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="¿Qué hay que hacer?"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500/50 transition-colors"
                    />
                </div>

                {/* Description */}
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Descripción (opcional)</label>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Detalles adicionales..."
                        rows={3}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500/50 transition-colors resize-none"
                    />
                </div>

                {/* Assigned To + Priority row */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Asignar a *</label>
                        <select
                            value={assignedTo}
                            onChange={e => setAssignedTo(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white outline-none focus:border-blue-500/50 transition-colors"
                        >
                            <option value="" className="bg-[#1c1c1e]">Seleccionar...</option>
                            {teamMembers.map(m => (
                                <option key={m.id} value={m.id} className="bg-[#1c1c1e]">
                                    {m.name || m.email}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Prioridad</label>
                        <select
                            value={priority}
                            onChange={e => setPriority(e.target.value as Priority)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white outline-none focus:border-blue-500/50 transition-colors"
                        >
                            {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                                <option key={key} value={key} className="bg-[#1c1c1e]">{cfg.icon} {cfg.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Deadline */}
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Fecha límite *</label>
                    <input
                        type="datetime-local"
                        value={deadline}
                        onChange={e => setDeadline(e.target.value)}
                        min={minDateStr}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50 transition-colors [color-scheme:dark]"
                    />
                </div>

                {/* Photos */}
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block flex items-center gap-2">
                        📸 Fotos adjuntas <span className="text-slate-600 font-normal normal-case tracking-normal">(opcional, máx. 30)</span>
                    </label>
                    <label className="flex items-center justify-center gap-2 w-full py-3 border border-dashed border-white/20 rounded-xl cursor-pointer hover:border-blue-500/40 hover:bg-blue-500/5 transition-colors">
                        <input
                            type="file" accept="image/*" multiple
                            className="hidden"
                            onChange={handlePhotoChange}
                        />
                        <span className="text-xs text-slate-400">{selectedPhotos.length === 0 ? 'Seleccionar fotos...' : `${selectedPhotos.length} foto${selectedPhotos.length > 1 ? 's' : ''} seleccionada${selectedPhotos.length > 1 ? 's' : ''}`}</span>
                    </label>
                    {photoPreviews.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                            {photoPreviews.map((src, i) => (
                                <div key={i} className="relative group">
                                    <img src={src} alt={`foto-${i}`} className="w-14 h-14 object-cover rounded-lg border border-white/10" />
                                    <button
                                        type="button"
                                        onClick={() => removePhoto(i)}
                                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={9} className="text-white" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 hover:text-white text-sm font-bold transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-black transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                        {saving ? 'Creando...' : 'Asignar Tarea'}
                    </button>
                </div>
            </form>
        </BaseModal>
    );
}
