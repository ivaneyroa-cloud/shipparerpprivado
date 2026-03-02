const fs = require('fs');
const path = 'C:\\Users\\ivane\\.gemini\\antigravity\\scratch\\shippar-courier-web\\src\\app\\admin\\dashboard\\shipments\\page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Chunk 1: import DateFilterPopup
content = content.replace(
    `import { useShipmentFilters } from '@/hooks/useShipmentFilters';
import { FilterDropdown } from '@/components/FilterDropdown';`,
    `import { useShipmentFilters } from '@/hooks/useShipmentFilters';
import { FilterDropdown } from '@/components/FilterDropdown';
import { DateFilterPopup } from '@/components/DateFilterPopup';`
);

// Chunk 2: Hook for virtual visible count
content = content.replace(
    `    const [userProfile, setUserProfile] = useState<any>(null);
    const [assignedClientNames, setAssignedClientNames] = useState<string[] | null>(null);`,
    `    const [userProfile, setUserProfile] = useState<any>(null);
    const [assignedClientNames, setAssignedClientNames] = useState<string[] | null>(null);
    const [visibleCount, setVisibleCount] = useState(50);`
);

// Chunk 3: Update visibleCount on fetch or filter (to reset pagination)
// Actually resetting on filter change via useEffect is smart:
content = content.replace(
    `    // Form & UI State`,
    `    useEffect(() => { setVisibleCount(50); }, [searchTerm, selectedStatuses, selectedFinalStatuses, selectedCategories, selectedOrigins, selectedClients, selectedCodes, dateShippedFrom, dateShippedTo, dateArrivedFrom, dateArrivedTo]);
    
    // Form & UI State`
);

// Chunk 4: replace the createPortal for dateShipped
const dateShippedRegex = /{openFilterDropdown === 'dateShipped' .*?<\/th>/s;
content = content.replace(
    dateShippedRegex,
    `<DateFilterPopup
                                            isOpen={openFilterDropdown === 'dateShipped'}
                                            onClose={() => setOpenFilterDropdown(null)}
                                            anchorRef={dateShippedRef}
                                            title="Rango de Fecha Salida"
                                            dateFrom={dateShippedFrom} setDateFrom={setDateShippedFrom}
                                            dateTo={dateShippedTo} setDateTo={setDateShippedTo}
                                        />
                                    </th>`
);

// Chunk 5: replace the createPortal for dateArrived
const dateArrivedRegex = /{openFilterDropdown === 'dateArrived' .*?<\/th>/s;
content = content.replace(
    dateArrivedRegex,
    `<DateFilterPopup
                                            isOpen={openFilterDropdown === 'dateArrived'}
                                            onClose={() => setOpenFilterDropdown(null)}
                                            anchorRef={dateArrivedRef}
                                            title="Rango de Fecha Llegada"
                                            dateFrom={dateArrivedFrom} setDateFrom={setDateArrivedFrom}
                                            dateTo={dateArrivedTo} setDateTo={setDateArrivedTo}
                                        />
                                    </th>`
);

// Chunk 6: Wrap rendered array in slice and add load more button
const renderRegex = /filteredShipments\.map\(\(s: any\) => \((.*?)\)\)/s;
content = content.replace(
    renderRegex,
    `filteredShipments.slice(0, visibleCount).map((s: any) => ($1))`
);

const tableEndRegex = /<\/table>\s*<\/div>\s*<\/div>/s;
content = content.replace(
    tableEndRegex,
    `
                            </table>
                            
                            {visibleCount < filteredShipments.length && (
                                <div className="py-8 flex justify-center w-full relative z-10">
                                    <button 
                                        onClick={() => setVisibleCount(v => v + 50)} 
                                        className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-[11px] uppercase tracking-widest px-8 py-3 rounded-xl transition-all shadow-sm active:scale-95"
                                    >
                                        VER {Math.min(50, filteredShipments.length - visibleCount)} MÁS... ({filteredShipments.length - visibleCount} restantes)
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>`
);


fs.writeFileSync(path, content, 'utf8');
console.log("Refactor Step 2 applied!");
