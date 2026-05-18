import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import DateRangePicker, { DateRangeValue } from '../components/common/DateRangePicker';
import ExportButton from '../components/common/ExportButton';
import { format, subDays } from 'date-fns';

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

  // Export data
  const exportData = sections.flatMap(sec =>
    sec.rows.map(row => {
      const obj: Record<string, string | number> = { Bölmə: sec.name, Xidmət: row.name };
      colDefs.forEach(col => { obj[col.name] = row.cells[col.key] || 0; });
      obj['Cəmi'] = rowTotal(row, colDefs.map(c => c.key));
      return obj;
    })
  );

  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Yüklənir...</div>;

  return (
    <div className="flex flex-col -m-6" style={{ height: 'calc(100vh - 56px)' }}>
      {/* ── Sabit yuxarı panel ── */}
      <div className="flex-shrink-0 px-6 pt-4 pb-3" style={{ background: '#f0f2f5', borderBottom: '1px solid #e2e8f0' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: '#94a3b8' }}>Hesabat</p>
            <h2 className="text-base font-bold" style={{ color: '#0f172a' }}>Maliyyə Cədvəli</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ExportButton data={exportData} filename="maliyye-cedveli" accentColor="#16a34a" />
            <button onClick={addSection}
              className="px-3 py-2 text-xs font-medium rounded-lg transition-colors"
              style={{ color: '#475569', border: '1px solid #e2e8f0', background: '#fff' }}>
              + Bölmə
            </button>
            <button onClick={resetToDefaults}
              className="px-3 py-2 text-xs font-medium rounded-lg transition-colors"
              style={{ color: '#dc2626', border: '1px solid #fee2e2', background: '#fff' }}>
              Sıfırla
            </button>
          </div>
        </div>

        <DateRangePicker value={dateRange} onChange={setDateRange} onApply={() => {}} accentColor="#34A853" />
        <div className="flex items-center gap-2 mt-3">
          <button onClick={() => autoPopulate(false)} disabled={autoLoading}
            className="px-4 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-50 transition-all"
            style={{ background: '#16a34a' }}>
            {autoLoading ? 'Yüklənir...' : 'Avtomatik Doldur'}
          </button>
          <button onClick={() => autoPopulate(true)} disabled={autoLoading}
            className="px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-50 transition-all"
            style={{ color: '#16a34a', border: '1px solid #16a34a', background: 'transparent' }}>
            Hamısını Yenilə
          </button>
          {autoResult && (
            <span className="text-xs font-medium" style={{ color: autoResult.startsWith('✓') ? '#16a34a' : '#dc2626' }}>
              {autoResult}
            </span>
          )}
        </div>
        <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
          Avtomatik Doldur — boş xanaları doldurur &nbsp;·&nbsp; Hamısını Yenilə — bütün auto xanaları əvəz edir &nbsp;·&nbsp; Əl ilə daxil edilənlər qorunur
        </p>
      </div>{/* ── sabit panel sonu ── */}

      {/* ── Sürüşdürülən cədvəl sahəsi ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5" style={{ background: '#f0f2f5' }}>
        {unmatched.length > 0 && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-xs font-semibold text-orange-700 mb-2">
              ⚠ Uyğun sətir tapılmayan kampaniyalar (hesabat cədvəlinə daxil edilmədi):
            </p>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {unmatched.map((u, i) => (
                <div key={i} className="text-xs text-orange-600">• {u}</div>
              ))}
            </div>
          </div>
        )}

      {/* Sections */}
      {sections.map(sec => {
        const visibleCols = colDefs.filter(c => sec.columns.includes(c.key));
        return (
          <div key={sec.id} className="mb-6 rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
            {/* Section header */}
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
              {renamingSectionId === sec.id ? (
                <div className="flex items-center gap-2">
                  <input value={renameSectionValue} onChange={e => setRenameSectionValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') renameSection(sec.id); if (e.key === 'Escape') setRenamingSectionId(null); }}
                    className="border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-[#34A853]" autoFocus />
                  <button onClick={() => renameSection(sec.id)} className="text-xs text-green-600 font-medium">Saxla</button>
                  <button onClick={() => setRenamingSectionId(null)} className="text-xs text-gray-400">Ləğv et</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-800 text-sm">{sec.name}</h3>
                  <button onClick={() => { setRenamingSectionId(sec.id); setRenameSectionValue(sec.name); }}
                    className="text-gray-400 hover:text-gray-600 text-xs">✏️</button>
                </div>
              )}
              <button onClick={() => deleteSection(sec.id)} className="text-gray-300 hover:text-red-400 text-xs px-2">🗑</button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-2.5 text-left text-gray-600 font-semibold bg-gray-50 min-w-[160px] sticky left-0 z-10">
                      Xidmət
                    </th>
                    {/* Group headers */}
                    {visibleCols.map(col => (
                      <th key={col.key} className="px-3 py-2.5 text-center font-semibold min-w-[90px]">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${GROUP_COLORS[col.group]}`}>
                          {col.name}
                        </span>
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-center font-semibold text-gray-700 bg-yellow-50 min-w-[100px]">
                      Cəmi
                    </th>
                    <th className="w-8 bg-gray-50"></th>
                  </tr>
                </thead>
                <tbody>
                  {((() => {
                    const isLifeSection = sec.name.toLowerCase().includes('life') || sec.name.toLowerCase().includes('vakansiya');
                    return isLifeSection
                      ? sec.rows.filter(r => rowTotal(r, visibleCols.map(c => c.key)) > 0)
                      : sec.rows;
                  })()).map(row => {
                    const total = rowTotal(row, visibleCols.map(c => c.key));
                    return (
                      <tr key={row.id} className="border-t border-gray-50 hover:bg-gray-50/60 group">
                        <td className="px-4 py-2 font-medium text-gray-800 bg-white sticky left-0 border-r border-gray-100">
                          {row.name}
                        </td>
                        {visibleCols.map(col => {
                          const val = row.cells[col.key] || 0;
                          const isEditing = editingCell?.rowId === row.id && editingCell?.colKey === col.key;
                          const isManual = col.group === 'manual';
                          return (
                            <td key={col.key}
                              className={`px-1 py-1 text-center cursor-pointer ${isManual ? 'bg-gray-50/40' : ''}`}
                              onClick={() => startEdit(sec.id, row.id, col.key, val)}>
                              {isEditing ? (
                                <input
                                  ref={inputRef}
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onBlur={commitEdit}
                                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCell(null); }}
                                  className="w-full text-center border-2 border-[#34A853] rounded px-1 py-0.5 outline-none text-xs font-medium bg-green-50"
                                  type="number"
                                  step="0.01"
                                />
                              ) : (
                                <span className={`block px-2 py-1 rounded hover:bg-green-50 transition-colors ${val ? 'text-gray-800 font-medium' : 'text-gray-300'}`}>
                                  {val ? fmtMoney(val) : <span className="text-gray-200 group-hover:text-gray-400">—</span>}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center font-bold text-gray-800 bg-yellow-50">
                          {total ? fmtMoney(total) : '—'}
                        </td>
                        <td className="px-1 py-2 text-center">
                          <button onClick={() => deleteRow(row.id)} className="text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">✕</button>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Total row */}
                  {sec.rows.length > 0 && (
                    <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                      <td className="px-4 py-2.5 text-gray-700 sticky left-0 bg-gray-50">Cəmi</td>
                      {visibleCols.map(col => {
                        const total = sectionColTotal(sec.rows, col.key);
                        return (
                          <td key={col.key} className="px-3 py-2.5 text-center text-gray-800">
                            {total ? fmtMoney(total) : '—'}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-center text-yellow-700 bg-yellow-100">
                        {fmtMoney(sec.rows.reduce((s, r) => s + rowTotal(r, visibleCols.map(c => c.key)), 0))}
                      </td>
                      <td></td>
                    </tr>
                  )}

                  {/* Add row */}
                  {addingRowSectionId === sec.id ? (
                    <tr className="border-t border-gray-100 bg-green-50">
                      <td className="px-4 py-2" colSpan={visibleCols.length + 3}>
                        <div className="flex items-center gap-2">
                          <input value={newRowName} onChange={e => setNewRowName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') addRow(sec.id); if (e.key === 'Escape') setAddingRowSectionId(null); }}
                            placeholder="Xidmət adı..." autoFocus
                            className="border border-[#34A853] rounded px-2 py-1 text-xs outline-none focus:border-[#34A853] bg-white w-48" />
                          <button onClick={() => addRow(sec.id)} className="text-xs text-white bg-[#34A853] px-3 py-1 rounded">Əlavə et</button>
                          <button onClick={() => setAddingRowSectionId(null)} className="text-xs text-gray-400">Ləğv et</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr className="border-t border-dashed border-gray-200">
                      <td colSpan={visibleCols.length + 3} className="px-4 py-2">
                        <button onClick={() => setAddingRowSectionId(sec.id)}
                          className="text-xs text-gray-400 hover:text-[#34A853] hover:underline transition-colors">
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

      {/* ── Grand Total ── */}
      {(() => {
        const googleKeys = ['search', 'display', 'video', 'pmax'];
        const metaKey = 'meta';
        const allRows = sections.flatMap(s => s.rows);
        const totalGoogle = allRows.reduce((sum, r) => sum + googleKeys.reduce((s, k) => s + (r.cells[k] || 0), 0), 0);
        const totalMeta   = allRows.reduce((sum, r) => sum + (r.cells[metaKey] || 0), 0);
        const grandTotal  = totalGoogle + totalMeta;
        if (!grandTotal) return null;
        return (
          <div className="mt-4 rounded-2xl overflow-hidden" style={{ border: '1px solid #e2e8f0', background: '#fff' }}>
            <div className="px-5 py-3" style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>Ümumi Xülasə</span>
            </div>
            <div className="flex items-stretch divide-x" style={{ borderColor: '#f1f5f9' }}>
              <div className="flex-1 px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4285F4' }}>Google Ads</p>
                <p className="text-2xl font-bold" style={{ color: '#0f172a' }}>{fmtMoney(totalGoogle)}</p>
                <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>Search · Display · Video · PMAX</p>
              </div>
              <div className="flex-1 px-6 py-5" style={{ borderLeft: '1px solid #f1f5f9' }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#1877F2' }}>Meta Ads</p>
                <p className="text-2xl font-bold" style={{ color: '#0f172a' }}>{fmtMoney(totalMeta)}</p>
                <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>Əsas Xidmətlər · Life</p>
              </div>
              <div className="flex-1 px-6 py-5" style={{ borderLeft: '1px solid #f1f5f9', background: '#f8fafc' }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#16a34a' }}>Cəmi</p>
                <p className="text-2xl font-bold" style={{ color: '#16a34a' }}>{fmtMoney(grandTotal)}</p>
                <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>Google + Meta</p>
              </div>
            </div>
          </div>
        );
      })()}

      <p className="text-xs text-gray-400 mt-3">
        💡 İstənilən xanaya klikləyin — dəyər daxil edin. Enter ilə təsdiqləyin, Escape ilə ləğv edin.
      </p>
      </div>{/* ── sürüşdürülən sahə sonu ── */}
    </div>
  );
}
