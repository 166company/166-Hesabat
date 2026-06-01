import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import DateRangePicker, { DateRangeValue } from '../components/common/DateRangePicker';
import ExportButton from '../components/common/ExportButton';
import { format, subDays } from 'date-fns';
import * as XLSX from 'xlsx';

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
const today = new Date();

interface ColDef { key: string; name: string; group: string; adType: string | null }
interface ReportRow { id: string; name: string; position: number; matchPatterns: string[]; cells: Record<string, number> }
interface ReportSection { id: string; name: string; position: number; columns: string[]; rows: ReportRow[] }

function fmtMoney(v: number) {
  if (!v) return '-';
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function rowTotal(row: ReportRow, colKeys: string[]) {
  return colKeys.reduce((s, k) => s + (row.cells[k] || 0), 0);
}

function sectionColTotal(rows: ReportRow[], colKey: string) {
  return rows.reduce((s, r) => s + (r.cells[colKey] || 0), 0);
}

const GROUP_COLORS: Record<string, string> = {
  google: 'bg-[#e8f0fe] text-[#4285F4]',
  meta:   'bg-[#e8f4ff] text-[#0082FB]',
  manual: 'bg-gray-100 text-gray-600',
};

export default function ReportTablePage() {
  const { t } = useTranslation();
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [colDefs, setColDefs] = useState<ColDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoResult, setAutoResult] = useState<string>('');
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [matchLog, setMatchLog] = useState<string[]>([]);
  const [showMatchLog, setShowMatchLog] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    startDate: fmt(subDays(today, 29)),
    endDate: fmt(today),
  });
  const [editingCell, setEditingCell] = useState<{ sectionId: string; rowId: string; colKey: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Add row / section UI
  const [addingRowSectionId, setAddingRowSectionId] = useState<string | null>(null);
  const [newRowName, setNewRowName] = useState('');
  const [renamingSectionId, setRenamingSectionId] = useState<string | null>(null);
  const [renameSectionValue, setRenameSectionValue] = useState('');

  useEffect(() => { loadSections(); }, []);

  async function loadSections() {
    try {
      const res = await api.get('/report-table/sections');
      setSections(res.data.sections);
      setColDefs(res.data.columnDefs);
    } catch { }
    finally { setLoading(false); }
  }

  function startEdit(sectionId: string, rowId: string, colKey: string, currentVal: number) {
    setEditingCell({ sectionId, rowId, colKey });
    setEditValue(currentVal ? String(currentVal) : '');
    setTimeout(() => inputRef.current?.select(), 50);
  }

  async function commitEdit() {
    if (!editingCell) return;
    const val = parseFloat(editValue) || 0;
    await api.put('/report-table/cell', { sectionId: editingCell.sectionId, rowId: editingCell.rowId, colKey: editingCell.colKey, value: val });
    setSections(prev => prev.map(sec => {
      if (sec.id !== editingCell.sectionId) return sec;
      return { ...sec, rows: sec.rows.map(r => r.id !== editingCell.rowId ? r : { ...r, cells: { ...r.cells, [editingCell.colKey]: val } }) };
    }));
    setEditingCell(null);
  }

  async function autoPopulate(force = false) {
    setAutoLoading(true); setAutoResult('Məlumatlar çəkilir, gözləyin...'); setUnmatched([]);
    try {
      // Meta API 14 hesab üçün çox vaxt aparır — timeout 10 dəqiqəyə artırılıb
      const res = await api.post('/report-table/auto-populate',
        { startDate: dateRange.startDate, endDate: dateRange.endDate, forceAll: force },
        { timeout: 600000 }
      );
      setAutoResult(`✓ ${res.data.populated} xana dolduruldu`);
      if (res.data.unmatched?.length) setUnmatched(res.data.unmatched);
      if (res.data.matchLog?.length) setMatchLog(res.data.matchLog);
      await loadSections();
    } catch (err: any) {
      const msg = err.code === 'ECONNABORTED' ? 'Timeout — çox vaxt apardı. Yenidən cəhd edin.' : (err.response?.data?.error || t('errors.general'));
      setAutoResult('⚠ ' + msg);
    } finally { setAutoLoading(false); }
  }

  async function addRow(sectionId: string) {
    if (!newRowName.trim()) return;
    await api.post('/report-table/row', { sectionId, rowName: newRowName.trim(), matchPatterns: [newRowName.toLowerCase()] });
    setNewRowName(''); setAddingRowSectionId(null);
    await loadSections();
  }

  async function deleteRow(rowId: string) {
    if (!confirm('Bu sətri silmək istəyirsiniz?')) return;
    await api.delete(`/report-table/row/${rowId}`);
    await loadSections();
  }

  async function renameSection(sectionId: string) {
    if (!renameSectionValue.trim()) return;
    await api.put(`/report-table/section/${sectionId}`, { name: renameSectionValue.trim() });
    setRenamingSectionId(null);
    await loadSections();
  }

  async function addSection() {
    const name = prompt('Yeni bölmə adı:');
    if (!name?.trim()) return;
    await api.post('/report-table/section', { name: name.trim() });
    await loadSections();
  }

  async function deleteSection(sectionId: string) {
    if (!confirm('Bu bölməni silmək istəyirsiniz? Bütün sətirlər və məlumatlar silinəcək.')) return;
    await api.delete(`/report-table/section/${sectionId}`);
    await loadSections();
  }

  async function resetToDefaults() {
    if (!confirm('Cədvəli standart vəziyyətə qaytarmaq istəyirsiniz?\nBütün mövcud məlumatlar silinəcək!')) return;
    await api.post('/report-table/reset');
    await loadSections();
  }

  // Export data (for other pages' ExportButton)
  const exportData = sections.flatMap(sec =>
    sec.rows.map(row => {
      const obj: Record<string, string | number> = { Bölmə: sec.name, Xidmət: row.name };
      colDefs.forEach(col => { obj[col.name] = row.cells[col.key] || 0; });
      obj['Cəmi'] = rowTotal(row, colDefs.map(c => c.key));
      return obj;
    })
  );

  function exportGoogleSheets() {
    const colKeys = colDefs.map(c => c.key);
    const colNames = colDefs.map(c => c.name);

    // Build rows array
    type Row = (string | number)[];
    const rows: Row[] = [];

    // Title
    rows.push([`MALIYYƏ CƏDVƏLİ — ${dateRange.startDate} / ${dateRange.endDate}`]);
    rows.push([]);

    // Column header row
    rows.push(['Xidmət', ...colNames, 'CƏMİ']);

    sections.forEach(sec => {
      // Section header
      rows.push([`▶ ${sec.name.toUpperCase()}`]);

      const sectionRows = (() => {
        const isLife = sec.name.toLowerCase().includes('life') || sec.name.toLowerCase().includes('vakansiya');
        return isLife ? sec.rows.filter(r => rowTotal(r, colKeys) > 0) : sec.rows;
      })();

      sectionRows.forEach(row => {
        const vals = colKeys.map(k => row.cells[k] || 0);
        const total = vals.reduce((a, b) => a + b, 0);
        rows.push([row.name, ...vals, total]);
      });

      // Section total
      const secTotals = colKeys.map(k => sectionColTotal(sec.rows, k));
      const secGrand = secTotals.reduce((a, b) => a + b, 0);
      rows.push(['CƏMI', ...secTotals, secGrand]);
      rows.push([]);
    });

    // Grand total
    const allRows = sections.flatMap(s => s.rows);
    const googleKeys = ['search', 'display', 'video', 'pmax'];
    const totalGoogle  = allRows.reduce((s, r) => s + googleKeys.reduce((a, k) => a + (r.cells[k] || 0), 0), 0);
    const totalMeta    = allRows.reduce((s, r) => s + (r.cells['meta'] || 0), 0);
    const totalTikTok  = allRows.reduce((s, r) => s + (r.cells['tiktok'] || 0), 0);
    const grandTotal   = totalGoogle + totalMeta + totalTikTok;

    rows.push(['ÜMUMI XÜLASƏ']);
    rows.push(['Google Ads (Search+Display+Video+PMAX)', totalGoogle]);
    rows.push(['Meta Ads', totalMeta]);
    rows.push(['TikTok Ads', totalTikTok]);
    rows.push(['ÜMUMİ CƏMİ', grandTotal]);

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Column widths
    ws['!cols'] = [
      { wch: 28 },
      ...colDefs.map(() => ({ wch: 12 })),
      { wch: 14 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Maliyyə Cədvəli');
    XLSX.writeFile(wb, `maliyye-cedveli-${dateRange.startDate}-${dateRange.endDate}.xlsx`);
  }

  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Yüklənir...</div>;

  const GROUP_BG: Record<string, string> = {
    google: 'rgba(66,133,244,0.08)',
    meta:   'rgba(24,119,242,0.08)',
    manual: 'rgba(100,116,139,0.06)',
  };
  const GROUP_TEXT: Record<string, string> = {
    google: '#4285F4',
    meta:   '#1877F2',
    manual: '#64748b',
  };

  return (
    <div className="flex flex-col -m-6 page-enter" style={{ height: 'calc(100vh - 56px)' }}>
      <style>{`
        .rt-th { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; padding:10px 12px; white-space:nowrap; }
        .rt-td { padding:0 4px; transition:background 0.15s; }
        .rt-row:hover .rt-name { background:#f8fafc; }
        .rt-row:hover { background:#f8fafc; }
        .rt-cell-val { display:block; padding:6px 8px; border-radius:8px; text-align:center; cursor:pointer; transition:all 0.15s; font-size:12px; }
        .rt-cell-val:hover { background:rgba(22,163,74,0.08); color:#16a34a; }
        .rt-total-row td { font-size:12px; font-weight:700; }
      `}</style>

      {/* ── Top panel ── */}
      <div className="flex-shrink-0 px-6 pt-4 pb-3" style={{ background: '#f0f4f8', borderBottom: '1px solid #e2e8f0' }}>
        {/* Hero header */}
        <div className="rounded-2xl px-5 py-4 mb-3 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #0f172a, #14532d)' }}>
          <div className="flex items-center gap-3">
            <div style={{ background: 'rgba(22,163,74,0.2)', borderRadius: 10, padding: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18"/>
              </svg>
            </div>
            <div>
              <p style={{ color: '#4ade80', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Hesabat</p>
              <h2 style={{ color: '#f8fafc', fontSize: 15, fontWeight: 700 }}>Maliyyə Cədvəli</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportGoogleSheets} className="btn-primary flex items-center gap-1.5"
              style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Google Sheets
            </button>
            <button onClick={addSection} className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
              style={{ color: '#94a3b8', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)' }}>
              + Bölmə
            </button>
            <button onClick={resetToDefaults} className="px-3 py-1.5 text-xs font-medium rounded-lg"
              style={{ color: '#fca5a5', border: '1px solid rgba(252,165,165,0.2)', background: 'rgba(220,38,38,0.08)' }}>
              Sıfırla
            </button>
          </div>
        </div>

        <DateRangePicker value={dateRange} onChange={setDateRange} onApply={() => {}} accentColor="#16a34a" />

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <button onClick={() => autoPopulate(false)} disabled={autoLoading}
            className="btn-primary flex items-center gap-2" style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>
            {autoLoading
              ? <><div style={{ width:12,height:12,border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/> Yüklənir...</>
              : '↓ Avtomatik Doldur'}
          </button>
          <button onClick={() => autoPopulate(true)} disabled={autoLoading}
            className="px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-50"
            style={{ color: '#16a34a', border: '1px solid #16a34a', background: 'transparent' }}>
            ↺ Hamısını Yenilə
          </button>
          {autoResult && (
            <span className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: autoResult.startsWith('✓') ? '#f0fdf4' : '#fef2f2', color: autoResult.startsWith('✓') ? '#16a34a' : '#dc2626' }}>
              {autoResult}
            </span>
          )}
        </div>
        <p className="text-xs mt-2" style={{ color: '#94a3b8' }}>
          Avtomatik Doldur — boş xanaları doldurur &nbsp;·&nbsp; Hamısını Yenilə — bütün auto xanaları əvəz edir &nbsp;·&nbsp; Əl ilə daxil edilənlər qorunur
        </p>
      </div>

      {/* ── Scrollable table area ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5" style={{ background: '#f0f4f8' }}>

        {unmatched.length > 0 && (
          <div className="mb-4 p-3 rounded-xl" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: '#c2410c' }}>
              ⚠ Xəbərdarlıqlar:
            </p>
            <div className="max-h-24 overflow-y-auto space-y-1">
              {unmatched.map((u, i) => (
                <div key={i} className="text-xs" style={{ color: u.includes('Kvota') ? '#b45309' : '#ea580c', fontWeight: u.includes('Kvota') ? 600 : 400 }}>• {u}</div>
              ))}
            </div>
          </div>
        )}

        {matchLog.length > 0 && (
          <div className="mb-4 p-3 rounded-xl" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold" style={{ color: '#0369a1' }}>🔍 Kampaniya uyğunlaşdırma loqu ({matchLog.length} kampaniya)</p>
              <button onClick={() => setShowMatchLog(v => !v)} className="text-xs" style={{ color: '#0369a1' }}>{showMatchLog ? 'Gizlət' : 'Göstər'}</button>
            </div>
            {showMatchLog && (
              <div className="max-h-48 overflow-y-auto space-y-0.5 mt-2">
                {matchLog.map((m, i) => (
                  <div key={i} className="text-xs font-mono" style={{ color: m.includes('fallback') ? '#b45309' : '#0369a1' }}>• {m}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {sections.map(sec => {
          const visibleCols = colDefs.filter(c => sec.columns.includes(c.key));
          const sectionRows = (() => {
            const isLife = sec.name.toLowerCase().includes('life') || sec.name.toLowerCase().includes('vakansiya');
            return isLife ? sec.rows.filter(r => rowTotal(r, visibleCols.map(c => c.key)) > 0) : sec.rows;
          })();

          return (
            <div key={sec.id} className="mb-5 rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              {/* Section header */}
              <div className="flex items-center justify-between px-5 py-3"
                style={{ background: 'linear-gradient(90deg,#f8fafc,#f1f5f9)', borderBottom: '2px solid #e2e8f0' }}>
                {renamingSectionId === sec.id ? (
                  <div className="flex items-center gap-2">
                    <input value={renameSectionValue} onChange={e => setRenameSectionValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') renameSection(sec.id); if (e.key === 'Escape') setRenamingSectionId(null); }}
                      className="border rounded-lg px-3 py-1.5 text-sm outline-none" style={{ borderColor: '#16a34a' }} autoFocus />
                    <button onClick={() => renameSection(sec.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ background: '#16a34a' }}>Saxla</button>
                    <button onClick={() => setRenamingSectionId(null)} className="text-xs" style={{ color: '#94a3b8' }}>Ləğv et</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div style={{ width: 3, height: 16, background: '#16a34a', borderRadius: 2 }} />
                    <h3 className="font-bold text-sm" style={{ color: '#0f172a' }}>{sec.name}</h3>
                    <button onClick={() => { setRenamingSectionId(sec.id); setRenameSectionValue(sec.name); }}
                      className="opacity-40 hover:opacity-100 transition-opacity text-xs ml-1" style={{ color: '#64748b' }}>✏</button>
                  </div>
                )}
                <button onClick={() => deleteSection(sec.id)}
                  className="opacity-30 hover:opacity-100 transition-opacity text-xs px-2" style={{ color: '#ef4444' }}>✕</button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th className="rt-th text-left sticky left-0 z-10" style={{ background: '#f8fafc', color: '#475569', minWidth: 160, borderRight: '1px solid #e2e8f0' }}>
                        Xidmət
                      </th>
                      {visibleCols.map(col => (
                        <th key={col.key} className="rt-th" style={{ color: GROUP_TEXT[col.group], minWidth: 90, background: GROUP_BG[col.group] }}>
                          {col.name}
                        </th>
                      ))}
                      <th className="rt-th" style={{ color: '#b45309', background: '#fffbeb', minWidth: 100 }}>Cəmi</th>
                      <th style={{ width: 28, background: '#f8fafc' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectionRows.map((row, idx) => {
                      const total = rowTotal(row, visibleCols.map(c => c.key));
                      return (
                        <tr key={row.id} className="rt-row group" style={{ borderTop: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                          <td className="rt-name px-4 py-2 text-xs font-semibold sticky left-0 z-10"
                            style={{ color: '#0f172a', borderRight: '1px solid #f1f5f9', background: 'inherit', minWidth: 160 }}>
                            {row.name}
                          </td>
                          {visibleCols.map(col => {
                            const val = row.cells[col.key] || 0;
                            const isEditing = editingCell?.rowId === row.id && editingCell?.colKey === col.key;
                            return (
                              <td key={col.key} className="rt-td" style={{ background: isEditing ? 'rgba(22,163,74,0.05)' : undefined }}
                                onClick={() => startEdit(sec.id, row.id, col.key, val)}>
                                {isEditing ? (
                                  <input ref={inputRef} value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    onBlur={commitEdit}
                                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCell(null); }}
                                    style={{ width: '100%', textAlign: 'center', border: '2px solid #16a34a', borderRadius: 8, padding: '5px 6px', outline: 'none', fontSize: 12, fontWeight: 600, background: '#f0fdf4' }}
                                    type="number" step="0.01" />
                                ) : (
                                  <span className="rt-cell-val" style={{ color: val ? '#0f172a' : '#cbd5e1', fontWeight: val ? 600 : 400 }}>
                                    {val ? fmtMoney(val) : '—'}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          <td style={{ textAlign: 'center', background: total ? '#fffbeb' : undefined, padding: '6px 12px' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: total ? '#92400e' : '#e2e8f0' }}>
                              {total ? fmtMoney(total) : '—'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', padding: '0 4px' }}>
                            <button onClick={() => deleteRow(row.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                              style={{ color: '#ef4444' }}>✕</button>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Total row */}
                    {sec.rows.length > 0 && (
                      <tr className="rt-total-row" style={{ borderTop: '2px solid #e2e8f0', background: 'linear-gradient(90deg,#f1f5f9,#f8fafc)' }}>
                        <td className="px-4 py-3 sticky left-0 text-xs font-bold" style={{ color: '#475569', borderRight: '1px solid #e2e8f0', background: '#f1f5f9' }}>
                          Cəmi
                        </td>
                        {visibleCols.map(col => {
                          const total = sectionColTotal(sec.rows, col.key);
                          return (
                            <td key={col.key} style={{ textAlign: 'center', padding: '10px 12px', color: total ? GROUP_TEXT[col.group] : '#e2e8f0' }}>
                              {total ? fmtMoney(total) : '—'}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'center', padding: '10px 12px', background: '#fef3c7' }}>
                          <span style={{ color: '#92400e', fontWeight: 800, fontSize: 13 }}>
                            {fmtMoney(sec.rows.reduce((s, r) => s + rowTotal(r, visibleCols.map(c => c.key)), 0))}
                          </span>
                        </td>
                        <td />
                      </tr>
                    )}

                    {/* Add row */}
                    {addingRowSectionId === sec.id ? (
                      <tr style={{ borderTop: '1px solid #f1f5f9', background: '#f0fdf4' }}>
                        <td className="px-4 py-2" colSpan={visibleCols.length + 3}>
                          <div className="flex items-center gap-2">
                            <input value={newRowName} onChange={e => setNewRowName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') addRow(sec.id); if (e.key === 'Escape') setAddingRowSectionId(null); }}
                              placeholder="Xidmət adı..." autoFocus
                              style={{ border: '1px solid #16a34a', borderRadius: 8, padding: '6px 10px', fontSize: 12, outline: 'none', background: '#fff', width: 200 }} />
                            <button onClick={() => addRow(sec.id)} className="btn-primary" style={{ background: '#16a34a', padding: '6px 14px' }}>Əlavə et</button>
                            <button onClick={() => setAddingRowSectionId(null)} style={{ fontSize: 12, color: '#94a3b8' }}>Ləğv et</button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr style={{ borderTop: '1px dashed #e2e8f0' }}>
                        <td colSpan={visibleCols.length + 3} className="px-4 py-2">
                          <button onClick={() => setAddingRowSectionId(sec.id)}
                            style={{ fontSize: 12, color: '#94a3b8', transition: 'color 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#16a34a')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}>
                            + Sətir əlavə et
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {/* Grand Total */}
        {(() => {
          const googleKeys = ['search', 'display', 'video', 'pmax'];
          const allRows = sections.flatMap(s => s.rows);
          const totalGoogle  = allRows.reduce((sum, r) => sum + googleKeys.reduce((s, k) => s + (r.cells[k] || 0), 0), 0);
          const totalMeta    = allRows.reduce((sum, r) => sum + (r.cells['meta'] || 0), 0);
          const totalTikTok  = allRows.reduce((sum, r) => sum + (r.cells['tiktok'] || 0), 0);
          const grandTotal   = totalGoogle + totalMeta + totalTikTok;
          if (!grandTotal) return null;
          return (
            <div className="rounded-2xl overflow-hidden mb-3" style={{ border: '1px solid #e2e8f0', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div className="px-5 py-3" style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a5f)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Ümumi Xülasə</span>
              </div>
              <div className="flex" style={{ background: '#fff' }}>
                {[
                  { label: 'Google Ads', value: totalGoogle,  color: '#4285F4', bg: 'rgba(66,133,244,0.06)', sub: 'Search · Display · Video · PMAX' },
                  { label: 'Meta Ads',   value: totalMeta,    color: '#1877F2', bg: 'rgba(24,119,242,0.06)', sub: 'Əsas Xidmətlər · Life' },
                  { label: 'TikTok Ads', value: totalTikTok,  color: '#000000', bg: 'rgba(0,0,0,0.03)',      sub: 'Bütün kampaniyalar' },
                  { label: 'Ümumi Cəmi', value: grandTotal,   color: '#16a34a', bg: 'rgba(22,163,74,0.06)',  sub: 'Google + Meta + TikTok' },
                ].map((item, i) => (
                  <div key={item.label} className="flex-1 px-6 py-5" style={{
                    borderLeft: i > 0 ? '1px solid #f1f5f9' : 'none',
                    background: item.bg,
                  }}>
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: item.color, marginBottom: 6 }}>{item.label}</p>
                    <p style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>{fmtMoney(item.value)}</p>
                    <p style={{ fontSize: 11, color: '#94a3b8' }}>{item.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
          💡 İstənilən xanaya klikləyin — dəyər daxil edin. Enter ilə təsdiqləyin, Escape ilə ləğv edin.
        </p>
      </div>
    </div>
  );
}
