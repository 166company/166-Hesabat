import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useDateRange } from '../context/DateRangeContext';
import { MetaBusinessSuite, MetaReport, MetaAccountReport } from '../types';
import DateRangePicker, { DateRangeValue } from '../components/common/DateRangePicker';
import MetricsCard from '../components/common/MetricsCard';
import ExportButton from '../components/common/ExportButton';
import ComparisonChart from '../components/common/ComparisonChart';
import { format, subDays } from 'date-fns';

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
const today = new Date();
function parseNum(v?: string | null) { return v ? parseFloat(v) || 0 : 0; }

export default function MetaAdsPage() {
  const { t } = useTranslation();
  const { range: globalRange, setRange: setGlobalRange } = useDateRange();
  const [suites, setSuites] = useState<MetaBusinessSuite[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeValue>(globalRange);
  const [report, setReport] = useState<MetaReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAddToken, setShowAddToken] = useState(false);

  // Token wizard — 2 addım: token → ad
  const [tokenStep, setTokenStep] = useState<'input' | 'name'>('input');
  const [tokenInput, setTokenInput] = useState('');
  const [groupName, setGroupName] = useState('');
  const [validatedUserName, setValidatedUserName] = useState('');
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardError, setWizardError] = useState('');

  // Hesab multi-select filtri
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<'all' | 'ACTIVE' | 'PAUSED'>('all');

  // Hesab expand/collapse
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

  useEffect(() => { loadSuites(true); }, []);

  async function loadSuites(autoFetch = false) {
    try {
      const res = await api.get('/meta/business-suites');
      setSuites(res.data.businessSuites);
      if (res.data.businessSuites.length > 0) {
        const firstId = res.data.businessSuites[0].id;
        if (!selectedSuiteId) setSelectedSuiteId(firstId);
        if (autoFetch) {
          setLoading(true); setError('');
          try {
            const r = await api.post('/meta/report', { tokenId: firstId, ...dateRange });
            setReport(r.data);
          } catch (e: any) {
            setError(e.response?.data?.error || 'Xəta baş verdi');
          } finally { setLoading(false); }
        }
      }
    } catch { }
  }

  // Addım 1: tokeni yoxla
  async function validateToken() {
    if (!tokenInput.trim()) return;
    setWizardError(''); setWizardLoading(true);
    try {
      const res = await api.post('/meta/preview-suites', { accessToken: tokenInput.trim() });
      if (!res.data.valid) { setWizardError('Token etibarsızdır.'); return; }
      setValidatedUserName(res.data.userName || '');
      setGroupName('');
      setTokenStep('name');
    } catch (err: any) {
      setWizardError(err.response?.data?.error || t('errors.general'));
    } finally { setWizardLoading(false); }
  }

  // Addım 2: qrup adını saxla
  async function saveToken() {
    if (!groupName.trim()) return;
    setWizardError(''); setWizardLoading(true);
    try {
      await api.post('/meta/token', { accessToken: tokenInput.trim(), groupName: groupName.trim() });
      resetWizard(); setShowAddToken(false);
      await loadSuites();
    } catch (err: any) {
      setWizardError(err.response?.data?.error || t('errors.general'));
    } finally { setWizardLoading(false); }
  }

  function resetWizard() {
    setTokenInput(''); setGroupName(''); setTokenStep('input');
    setValidatedUserName(''); setWizardError('');
  }

  async function removeToken(id: string) {
    await api.delete(`/meta/token/${id}`);
    setSuites(s => s.filter(x => x.id !== id));
    if (selectedSuiteId === id) { setSelectedSuiteId(''); setReport(null); }
  }

  async function fetchReport() {
    if (!selectedSuiteId) return;
    setLoading(true); setError(''); setExpandedAccounts(new Set());
    try {
      const res = await api.post('/meta/report', { tokenId: selectedSuiteId, ...dateRange });
      setReport(res.data);
      // Default: hamısı seçili, hamısı bağlı
      setSelectedAccountIds(new Set(res.data.reports.map((r: MetaAccountReport) => r.account.id)));
      setExpandedAccounts(new Set()); // hamısı bağlı başlayır
    } catch (err: any) {
      const e = err.response?.data;
      if (e?.expired) { setError(t('meta.tokenExpired')); await loadSuites(); }
      else setError(e?.error || t('errors.general'));
    } finally { setLoading(false); }
  }

  function toggleAccount(id: string) {
    setSelectedAccountIds(prev => {
      const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
    });
  }

  function toggleExpand(id: string) {
    setExpandedAccounts(prev => {
      const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
    });
  }

  function expandAll() { setExpandedAccounts(new Set(allReports.map(r => r.account.id))); }
  function collapseAll() { setExpandedAccounts(new Set()); }

  const allReports = report?.reports || [];
  const visibleReports = allReports.filter(r => selectedAccountIds.has(r.account.id));

  const agg = visibleReports.reduce(
    (acc, r) => ({
      spend: acc.spend + parseNum(r.insights.spend),
      impressions: acc.impressions + parseNum(r.insights.impressions),
      clicks: acc.clicks + parseNum(r.insights.clicks),
      reach: acc.reach + parseNum(r.insights.reach),
    }),
    { spend: 0, impressions: 0, clicks: 0, reach: 0 }
  );
  const prevAgg = visibleReports.reduce(
    (acc, r) => ({
      spend: acc.spend + parseNum(r.previousInsights?.spend),
      impressions: acc.impressions + parseNum(r.previousInsights?.impressions),
      clicks: acc.clicks + parseNum(r.previousInsights?.clicks),
      reach: acc.reach + parseNum(r.previousInsights?.reach),
    }),
    { spend: 0, impressions: 0, clicks: 0, reach: 0 }
  );

  const chartData = visibleReports.map(r => ({
    name: r.account.name.substring(0, 15),
    current: parseNum(r.insights.spend),
    previous: parseNum(r.previousInsights?.spend),
  }));

  const exportData = visibleReports.flatMap(r =>
    r.campaigns
      .filter(c => campaignStatusFilter === 'all' || c.status === campaignStatusFilter)
      .map(c => ({
        Hesab: r.account.name, Kampaniya: c.name, Status: c.status, Məqsəd: c.objective,
        'Xərc ($)': parseNum(c.insights?.spend).toFixed(2),
        Göstərilmə: c.insights?.impressions, Klik: c.insights?.clicks, CTR: c.insights?.ctr,
      }))
  );

  const isAllAccSelected = allReports.length > 0 && allReports.every(r => selectedAccountIds.has(r.account.id));

  return (
    <div className="max-w-6xl page-enter">
      {/* Hero Header */}
      <div className="page-hero mb-5" style={{ background: 'linear-gradient(135deg, #0f172a, #1e3a5f)' }}>
        <div className="flex items-center gap-3">
          <div style={{ background: 'rgba(24,119,242,0.2)', borderRadius: 12, padding: 10 }}>
            <svg width="28" height="18" viewBox="0 0 74 46" fill="none">
              <path d="M0 23C0 10 8 0 18 0C25 0 30 5 33 12C36 19 37 26 37 33C37 26 38 19 41 12C44 5 49 0 56 0C66 0 74 10 74 23C74 36 66 46 56 46C49 46 44 41 41 34C38 27 37 23 37 23C37 23 36 27 33 34C30 41 25 46 18 46C8 46 0 36 0 23Z" fill="#1877F2"/>
            </svg>
          </div>
          <div>
            <p style={{ color: '#60a5fa', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Reklam Analitikası</p>
            <h2 style={{ color: '#f8fafc', fontSize: 16, fontWeight: 700 }}>{t('meta.title')}</h2>
          </div>
        </div>
        <div className="flex gap-2">
          {report && <ExportButton data={exportData} filename="meta-ads-report" accentColor="#0082FB" />}
          <button onClick={() => { setShowAddToken(!showAddToken); resetWizard(); }}
            className="btn-primary" style={{ background: '#1877F2' }}>
            + {t('meta.addToken')}
          </button>
        </div>
      </div>

      {/* ── Token Wizard ── */}
      {showAddToken && (
        <div className="mb-6 bg-[#e8f4ff] border border-[#0082FB]/20 rounded-xl p-5">
          {tokenStep === 'input' ? (
            <>
              <h3 className="text-sm font-semibold text-[#0082FB] mb-1">Facebook Access Token</h3>
              <p className="text-xs text-gray-500 mb-4">
                Token daxil edin. Sistem bütün əlçatılan hesabları avtomatik tapacaq.
              </p>
              {wizardError && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{wizardError}</div>}
              <div className="flex gap-2">
                <input value={tokenInput} onChange={e => setTokenInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && validateToken()}
                  type="password" placeholder="EAAxxxxx..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0082FB]" />
                <button onClick={validateToken} disabled={wizardLoading || !tokenInput.trim()}
                  className="px-4 py-2 text-xs font-medium text-white rounded-lg bg-[#0082FB] hover:bg-[#0064D2] disabled:opacity-50 whitespace-nowrap">
                  {wizardLoading ? '⏳ Yüklənir...' : '✓ Yoxla'}
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Token almaq:{' '}
                <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer" className="text-[#0082FB] hover:underline">
                  Graph API Explorer
                </a>{' '}
                → <code className="bg-gray-100 px-1 rounded">ads_read</code>
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-green-600 text-sm">✓</span>
                    <h3 className="text-sm font-semibold text-[#0082FB]">Token Təsdiqləndi</h3>
                    {validatedUserName && <span className="text-xs text-gray-500">— {validatedUserName}</span>}
                  </div>
                  <p className="text-xs text-gray-500">Bu token qrupu üçün bir ad təyin edin:</p>
                </div>
                <button onClick={resetWizard} className="text-xs text-gray-400 hover:text-gray-600">← Geri</button>
              </div>
              {wizardError && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{wizardError}</div>}
              <div className="flex gap-2">
                <input value={groupName} onChange={e => setGroupName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveToken()}
                  placeholder="örn. 166 Bütün Hesablar, Şirkət Reklamları..."
                  className="flex-1 border border-[#0082FB]/40 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0082FB] bg-white"
                  autoFocus />
                <button onClick={saveToken} disabled={wizardLoading || !groupName.trim()}
                  className="px-4 py-2 text-xs font-medium text-white rounded-lg bg-[#0082FB] hover:bg-[#0064D2] disabled:opacity-50 whitespace-nowrap">
                  {wizardLoading ? 'Saxlanılır...' : '💾 Saxla'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Stored token groups */}
      {suites.length > 0 && (
        <div className="mb-4">
          <label className="block text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Qruplar</label>
          <div className="flex flex-wrap gap-2">
            {suites.map(s => (
              <div key={s.id} className="flex items-center gap-1">
                <button onClick={() => { setSelectedSuiteId(s.id); setReport(null); }}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                    selectedSuiteId === s.id ? 'bg-[#0082FB] text-white border-[#0082FB]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#0082FB]'
                  } ${!s.isValid ? 'opacity-50' : ''}`}>
                  📁 {s.businessSuiteName}{!s.isValid && ' ⚠️'}
                </button>
                <button onClick={() => removeToken(s.id)} title="Sil"
                  className="text-gray-400 hover:text-red-500 text-xs px-1">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {suites.length === 0 && !showAddToken && (
        <div className="mb-6 rounded-2xl p-10 text-center" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📘</div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#0f172a' }}>{t('meta.noSuites')}</p>
          <p className="text-xs mb-4" style={{ color: '#94a3b8' }}>Facebook Access Token əlavə edin</p>
          <button onClick={() => setShowAddToken(true)} className="btn-primary" style={{ background: '#1877F2' }}>+ {t('meta.addToken')}</button>
        </div>
      )}

      {suites.length > 0 && (
        <div className="mb-6">
          <DateRangePicker value={dateRange} onChange={v => { setDateRange(v); setGlobalRange(v); }} onApply={fetchReport} accentColor="#0082FB" />
        </div>
      )}

      {error && <div className="mb-4 p-3 rounded-xl text-xs" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2' }}>{error}</div>}
      {loading && <div className="flex flex-col items-center justify-center py-16 gap-4"><div className="loading-spinner"/><span style={{ color: '#94a3b8', fontSize: 13 }}>{t('common.loading')}</span></div>}

      {report && allReports.length > 0 && (
        <>
          {/* Account filter + campaign status */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Hesablar — {selectedAccountIds.size}/{allReports.length} seçilib
              </span>
              <div className="flex gap-2">
                <button onClick={() => setSelectedAccountIds(new Set(allReports.map(r => r.account.id)))}
                  disabled={isAllAccSelected} className="text-xs text-[#0082FB] hover:underline disabled:opacity-40">Hamısını seç</button>
                <span className="text-gray-300">|</span>
                <button onClick={() => setSelectedAccountIds(new Set())}
                  disabled={selectedAccountIds.size === 0} className="text-xs text-gray-500 hover:underline disabled:opacity-40">Təmizlə</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {allReports.map(r => {
                const isSelected = selectedAccountIds.has(r.account.id);
                return (
                  <button key={r.account.id} onClick={() => toggleAccount(r.account.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all ${
                      isSelected ? 'bg-[#0082FB] text-white border-[#0082FB] shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-[#0082FB]'
                    }`}>
                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-white border-white' : 'border-gray-300'}`}>
                      {isSelected && <span className="text-[#0082FB] text-xs font-bold">✓</span>}
                    </span>
                    <span className="font-medium truncate max-w-[150px]" title={r.account.name}>{r.account.name}</span>
                    <span className={`${isSelected ? 'text-white/70' : 'text-gray-400'}`}>${parseNum(r.insights.spend).toFixed(0)}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">Kampaniya:</span>
              {(['all', 'ACTIVE', 'PAUSED'] as const).map(f => (
                <button key={f} onClick={() => setCampaignStatusFilter(f)}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-all ${
                    campaignStatusFilter === f
                      ? f === 'ACTIVE' ? 'bg-green-600 text-white border-green-600'
                      : f === 'PAUSED' ? 'bg-gray-500 text-white border-gray-500'
                      : 'bg-[#0082FB] text-white border-[#0082FB]'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}>
                  {f === 'all' ? 'Hamısı' : f === 'ACTIVE' ? '● Aktiv' : '◌ Deaktiv'}
                </button>
              ))}
            </div>
          </div>

          {selectedAccountIds.size === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Hesab seçin</div>
          ) : (
            <>
              {/* Summary metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <MetricsCard label={t('metrics.totalSpend')} value={agg.spend.toFixed(2)} previous={dateRange.prevStartDate ? prevAgg.spend : undefined} prefix="$" color="#0082FB" />
                <MetricsCard label={t('metrics.totalImpressions')} value={agg.impressions} previous={dateRange.prevStartDate ? prevAgg.impressions : undefined} color="#0082FB" />
                <MetricsCard label={t('metrics.totalClicks')} value={agg.clicks} previous={dateRange.prevStartDate ? prevAgg.clicks : undefined} color="#0082FB" />
                <MetricsCard label={t('metrics.totalReach')} value={agg.reach} previous={dateRange.prevStartDate ? prevAgg.reach : undefined} color="#0082FB" />
              </div>

              {/* Chart */}
              {chartData.length > 1 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Hesablara görə xərc ($)</h3>
                  <ComparisonChart data={chartData} metric="spend" type="bar" primaryColor="#0082FB" secondaryColor="#a8d5ff"
                    showPrevious={!!dateRange.prevStartDate} valueFormatter={v => `$${v.toFixed(2)}`} />
                </div>
              )}

              {/* Expand/Collapse all */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  {visibleReports.length} hesab
                </span>
                <div className="flex gap-2">
                  <button onClick={expandAll} className="text-xs text-[#0082FB] hover:underline">Hamısını aç ▼</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={collapseAll} className="text-xs text-gray-500 hover:underline">Hamısını bağla ▲</button>
                </div>
              </div>

              {/* Per account — expand/collapse */}
              {visibleReports.map(r => {
                const isExpanded = expandedAccounts.has(r.account.id);
                const filtered = r.campaigns.filter(c => campaignStatusFilter === 'all' || c.status === campaignStatusFilter);
                return (
                  <div key={r.account.id} className="mb-3 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Account header — always visible, click to toggle */}
                    <div
                      className="bg-[#e8f4ff] px-5 py-3 border-b border-[#0082FB]/10 flex items-center justify-between cursor-pointer hover:bg-[#d6eeff] transition-colors"
                      onClick={() => toggleExpand(r.account.id)}>
                      <div className="flex items-center gap-3">
                        <span className="text-[#0082FB] text-sm font-bold">{isExpanded ? '▼' : '▶'}</span>
                        <div>
                          <h3 className="font-semibold text-[#0082FB] text-sm">{r.account.name}</h3>
                          <span className="text-xs text-gray-500">ID: {r.account.id} · {r.account.currency}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        <span>💰 <strong className="text-[#0082FB]">${parseNum(r.insights.spend).toFixed(2)}</strong></span>
                        <span>👁 {parseNum(r.insights.impressions).toLocaleString()}</span>
                        <span>🖱 {parseNum(r.insights.clicks).toLocaleString()}</span>
                        <span className={`px-2 py-0.5 rounded-full ${r.account.account_status === 1 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {r.account.account_status === 1 ? 'Aktiv' : 'Deaktiv'}
                        </span>
                        <span className="text-gray-400 text-xs">{filtered.length} kampaniya</span>
                      </div>
                    </div>

                    {/* Campaigns — only when expanded */}
                    {isExpanded && (
                      <div className="overflow-x-auto">
                        {filtered.length === 0 ? (
                          <div className="text-center py-6 text-gray-400 text-xs">
                            {campaignStatusFilter !== 'all' ? 'Bu filtrlə kampaniya tapılmadı' : t('meta.noData')}
                          </div>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="px-4 py-2.5 text-left text-gray-500 font-medium min-w-[180px]">{t('meta.campaign')}</th>
                                <th className="px-3 py-2.5 text-left text-gray-500 font-medium">Status</th>
                                <th className="px-3 py-2.5 text-left text-gray-500 font-medium">{t('meta.objective')}</th>
                                <th className="px-3 py-2.5 text-right text-gray-500 font-medium">Xərc ($)</th>
                                <th className="px-3 py-2.5 text-right text-gray-500 font-medium">Göstərilmə</th>
                                <th className="px-3 py-2.5 text-right text-gray-500 font-medium">Klik</th>
                                <th className="px-3 py-2.5 text-right text-gray-500 font-medium">CTR</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filtered.map(c => (
                                <tr key={c.id} className="border-t border-gray-50 hover:bg-blue-50/30 transition-colors">
                                  <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[200px] truncate" title={c.name}>{c.name}</td>
                                  <td className="px-3 py-2.5">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                      {c.status === 'ACTIVE' ? '● Aktiv' : '◌ ' + c.status}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-gray-500">{c.objective}</td>
                                  <td className="px-3 py-2.5 text-right font-semibold text-[#0082FB]">${parseNum(c.insights?.spend).toFixed(2)}</td>
                                  <td className="px-3 py-2.5 text-right text-gray-700">{parseNum(c.insights?.impressions).toLocaleString()}</td>
                                  <td className="px-3 py-2.5 text-right text-gray-700">{parseNum(c.insights?.clicks).toLocaleString()}</td>
                                  <td className="px-3 py-2.5 text-right text-gray-700">{parseNum(c.insights?.ctr).toFixed(2)}%</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-[#f0f8ff] border-t-2 border-[#0082FB]/20 text-xs font-semibold">
                                <td className="px-4 py-2 text-gray-600" colSpan={3}>Cəmi ({filtered.length})</td>
                                <td className="px-3 py-2 text-right text-[#0082FB]">${filtered.reduce((s, c) => s + parseNum(c.insights?.spend), 0).toFixed(2)}</td>
                                <td className="px-3 py-2 text-right text-gray-600">{filtered.reduce((s, c) => s + parseNum(c.insights?.impressions), 0).toLocaleString()}</td>
                                <td className="px-3 py-2 text-right text-gray-600">{filtered.reduce((s, c) => s + parseNum(c.insights?.clicks), 0).toLocaleString()}</td>
                                <td className="px-3 py-2"></td>
                              </tr>
                            </tfoot>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </>
      )}
    </div>
  );
}
