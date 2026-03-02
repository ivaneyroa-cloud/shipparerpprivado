const fs = require('fs');
const file = 'C:\\Users\\ivane\\.gemini\\antigravity\\scratch\\shippar-courier-web\\src\\app\\admin\\dashboard\\shipments\\page.tsx';
let txt = fs.readFileSync(file, 'utf8');

txt = txt.replace(/import { es } from 'date-fns\/locale';/g, "import { useExcelImport } from '@/hooks/useExcelImport';\nimport { ShipmentRow } from '@/components/ShipmentRow';\nimport { DateFilterPopup } from '@/components/DateFilterPopup';");

txt = txt.replace(/const \[uploadingCsv, setUploadingCsv\] = useState\(false\);/, "");

txt = txt.replace(/const \[assignedClientNames, setAssignedClientNames\] = useState<string\[\] \| null>\(null\);/, "const [assignedClientNames, setAssignedClientNames] = useState<string[] | null>(null);\n    const [visibleCount, setVisibleCount] = useState(50);\n    const { uploadingCsv, handleFileUpload } = useExcelImport(() => fetchShipments());");

// remove unused imports
txt = txt.replace(/import \* as XLSX from 'xlsx';/, "");

// remove chunk 6 from my earlier attempt (since it didn't match perfectly)
txt = txt.replace(/const handleFileUpload = async.*?reader\.readAsArrayBuffer\(file\);\s*};\s*const deleteShipments/s, "const deleteShipments");

fs.writeFileSync(file, txt);
console.log("Fixed!");
