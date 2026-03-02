import { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function useExcelImport(onSuccess: () => void) {
    const [uploadingCsv, setUploadingCsv] = useState(false);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingCsv(true);
        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                const arrayBuffer = event.target?.result as ArrayBuffer;
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

                if (rows.length === 0) throw new Error("El archivo está vacío");

                // Fetch org_id — required by INSERT RLS policy
                const { data: orgId } = await supabase.rpc('user_org_id');
                if (!orgId) throw new Error('No se pudo obtener el org_id del usuario');

                const { data: currentClients } = await supabase.from('clients').select('id, name, code');

                const newShipments = rows.map((row, index) => {
                    const obj: any = {};
                    Object.keys(row).forEach(key => {
                        obj[key.toLowerCase().trim()] = row[key];
                    });

                    // Smart Matching
                    const findValue = (keysToSearch: string[], forceString = false) => {
                        for (let k of keysToSearch) {
                            const foundKey = Object.keys(obj).find(ok => ok.includes(k));
                            if (foundKey && obj[foundKey]) {
                                return forceString ? String(obj[foundKey]).trim() : obj[foundKey];
                            }
                        }
                        return null;
                    }

                    const processDate = (val: any) => {
                        if (!val) return null;
                        if (typeof val === 'number') {
                            const date = new Date((val - (25567 + 2)) * 86400 * 1000);
                            return date.toISOString().split('T')[0];
                        }
                        if (typeof val === 'string') {
                            return val.includes('/') || val.includes('-') ? val : null;
                        }
                        return null;
                    };

                    const possibleClientName = findValue(['cliente', 'client', 'nombre', 'razon']) || 'CLIENTE EXCEL';
                    const possibleClientCode = findValue(['codigo', 'code', 'código']) || 'EXC';

                    const matchedClient = currentClients?.find(c =>
                        c.name.toLowerCase() === possibleClientName.toLowerCase() ||
                        c.code.toLowerCase() === possibleClientName.toLowerCase() ||
                        c.code.toLowerCase() === possibleClientCode.toLowerCase()
                    );

                    return {
                        tracking_number: findValue(['tracking', 'guia', 'guía', 'seguimiento', '1z', '10j'], true) || `EXC-${Date.now()}-${index}`,
                        client_name: matchedClient ? matchedClient.name : possibleClientName,
                        client_code: matchedClient ? matchedClient.code : possibleClientCode,
                        client_id: matchedClient ? matchedClient.id : null,
                        category: findValue(['categor', 'rubro', 'tipo', 'producto', 'ropa']) || 'OTROS',
                        weight: parseFloat(findValue(['peso', 'weight', 'kg', 'kilo'])) || 0,
                        internal_status: findValue(['estado', 'status', 'situacion']) || 'Guía Creada',
                        origin: findValue(['origen', 'origin', 'pais']) || 'CHINA',
                        date_shipped: processDate(findValue(['salida', 'shipped'])) || null,
                        date_arrived: processDate(findValue(['llegada', 'arrived', 'arribo'])) || null,
                        org_id: orgId, // Required by INSERT RLS policy
                    };
                });

                const uniqueShipments = Array.from(new Map(newShipments.map(item => [item.tracking_number, item])).values());

                const { error } = await supabase.from('shipments').upsert(uniqueShipments, { onConflict: 'tracking_number' });
                if (error) throw error;

                try {
                    const excelCategories = Array.from(new Set(uniqueShipments.map(s => s.category.toUpperCase().trim())));
                    const excelOrigins = Array.from(new Set(uniqueShipments.map(s => s.origin.toUpperCase().trim())));

                    const { data: currentCategories } = await supabase.from('categories').select('name');
                    const { data: currentOrigins } = await supabase.from('origins').select('name');

                    const existingCatNames = new Set(currentCategories?.map(c => c.name.toUpperCase()) || []);
                    const existingOrigNames = new Set(currentOrigins?.map(o => o.name.toUpperCase()) || []);

                    const newCategoriesToInsert = excelCategories.filter(c => !existingCatNames.has(c) && c !== 'OTROS').map(name => ({ name }));
                    const newOriginsToInsert = excelOrigins.filter(o => !existingOrigNames.has(o) && o !== 'CHINA').map(name => ({ name }));

                    if (newCategoriesToInsert.length > 0) {
                        await supabase.from('categories').insert(newCategoriesToInsert);
                    }
                    if (newOriginsToInsert.length > 0) {
                        await supabase.from('origins').insert(newOriginsToInsert);
                    }
                } catch (syncError) {
                    console.error("Error al sincronizar nuevas categorías/orígenes: ", syncError);
                }

                toast.success(`¡Se importaron ${newShipments.length} envíos correctamente!`);
                onSuccess();
            } catch (error: any) {
                toast.error(`Error importando Excel: ${error.message}`);
            } finally {
                setUploadingCsv(false);
                e.target.value = '';
            }
        };

        reader.readAsArrayBuffer(file);
    };

    return { uploadingCsv, handleFileUpload };
}
