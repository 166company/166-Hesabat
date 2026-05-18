import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';

interface Props {
  data: Record<string, unknown>[];
  filename?: string;
  accentColor?: string;
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const header = keys.join(',');
  const lines = rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? '')).join(','));
  return [header, ...lines].join('\n');
}

export default function ExportButton({ data, filename = 'export', accentColor = '#4285F4' }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  function downloadCSV() {
    const csv = toCSV(data);
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}.csv`; a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  function downloadExcel() {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${filename}.xlsx`);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-xs text-white rounded-lg transition-colors"
        style={{ backgroundColor: accentColor }}
      >
        ⬇ {t('export.download')}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
          <button onClick={downloadCSV} className="block w-full px-4 py-2 text-xs text-left hover:bg-gray-50 text-gray-700">
            📄 {t('export.csv')}
          </button>
          <button onClick={downloadExcel} className="block w-full px-4 py-2 text-xs text-left hover:bg-gray-50 text-gray-700">
            📊 {t('export.excel')}
          </button>
        </div>
      )}
    </div>
  );
}
