import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useDateRange } from '../context/DateRangeContext';
import { GoogleStatus, GoogleReport, GoogleCampaign, GoogleCustomer } from '../types';
import DateRangePicker, { DateRangeValue } from '../components/common/DateRangePicker';
import MetricsCard from '../components/common/MetricsCard';
import ExportButton from '../components/common/ExportButton';
import ComparisonChart from '../components/common/ComparisonChart';
import { format, subDays } from 'date-fns';

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
const today = new Date();

const TYPE_COLORS: Record<string, string> = {
  SEARCH: '#4285F4', DISPLAY: '#34A853', VIDEO: '#EA4335',
  SHOPPING: '#FBBC04', PERFORMANCE_MAX: '#9334EA', UNKNOWN: '#9CA3AF',
};
const TYPE_LABELS: Record<string, string> = {
  SEARCH: 'Search', DISPLAY: 'Display', VIDEO: 'Video',
  SHOPPING: 'Shopping', PERFORMANCE_MAX: 'Performance Max',
};

type StatusFilter = 'all' | 'ENABLED' | 'PAUSED';

interface CustomerReport {
  customer: GoogleCustomer;
  report: GoogleReport;
}

export default function GoogleAdsPage() {
  const { t } = useTranslation();
  const { range: globalRange, setRange: setGlobalRange } = useDateRange();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeValue>(globalRange);

  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [customerReports, setCustomerReports] = useState<CustomerReport[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [step, setStep] = useState<'status' | 'verify'>('status');
  const [connectLoading, setConnectLoading] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [expandedKeywords, setExpandedKeywords] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadStatus(false);
    if (searchParams.get('step') === 'verify') setStep('verify');
    const e = searchParams.get('error');
    if (e) setError(`OAuth xətası: ${e}`);
  }, []);

  async function loadStatus(autoFetch = false) {
    try {
      const res = await api.get('/google/status');
      setStatus(res.data);
      if (res.data.customers?.length > 0) {
        const ids = new Set<string>(res.data.customers.map((c: GoogleCustomer) => c.id));
        setSelectedCustomerIds(ids);
        if (autoFetch) {
          setLoading(true); setError(''); setCustomerReports([]);
          const results = await Promise.allSettled(
            [...ids].map(id => {
              const c = res.data.customers.find((x: GoogleCustomer) => x.id === id);
              return api.post('/google/report', { customerId: id, managerId: c?.managerId, ...dateRange });
            })
          );
          const reports: CustomerReport[] = [];
          results.forEach((r, i) => {
            if (r.status === 'fulfilled') {
              const c = res.data.customers[i];
              reports.push({ customer: c, report: r.value.data });
            }
          });
          setCustomerReports(reports);
          setLoading(false);
        }
      }
    } catch { }
  }

  async function connectGoogle() {
    setConnectLoading(true);
    try {
      const res = await api.get('/google/auth-url');
      window.location.href = res.data.url;
    } catch (err: any) {
      setError(err.response?.data?.error || t('errors.general'));
      setConnectLoading(false);
    }
  }

  async function disconnect() {
    await api.delete('/google/disconnect');
    setStatus(null); setCustomerReports([]); setStep('status');
  }

  async function verifyEmail() {
    setVerifyError(''); setVerifyLoading(true);
    try {
      const res = await api.post('/google/verify', { code: verifyCode });
      if (res.data.verified) { await loadStatus(); setStep('status'); }
    } catch (err: any) {
      setVerifyError(err.response?.data?.error || t('errors.general'));
    } finally { setVerifyLoading(false); }
  }

  async function fetchReport() {
    if (selectedCustomerIds.size === 0) { setError('Ən az bir hesab seçin'); return; }
    setLoading(true); setError(''); setExpandedAccounts(new Set()); setExpandedKeywords(new Set());
    try {
      const results = await Promise.all(
        [...selectedCustomerIds].map(async (customerId) => {
          const res = await api.post('/google/report', { customerId, ...dateRange });
          const customer = status?.customers?.find(c => c.id === customerId) || { id: customerId, name: `Account ${customerId}` };
          return { customer, report: res.data as GoogleReport };
        })
      );
      setCustomerReports(results);
    } catch (err: any) {
      setError(err.response?.data?.error || t('errors.general'));
    } finally { setLoading(false); }
  }

  function toggleCustomer(id: string) {
    setSelectedCustomerIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function toggleAccount(id: string) {
    setExpandedAccounts(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function toggleKeywords(key: string) {
    setExpandedKeywords(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  }

  function expandAll() { setExpandedAccounts(new Set(customerReports.map(cr => cr.customer.id))); }
  function collapseAll() { setExpandedAccounts(new Set()); }

  const customers = status?.customers || [];
  const isAllSelected = customers.length > 0 && customers.every(c => selectedCustomerIds.has(c.id));

  const allCampaigns: (GoogleCampaign & { customerName: string; customerId: string })[] =
    customerReports.flatMap(cr => cr.report.campaigns.map(c => ({ ...c, customerName: cr.customer.name, customerId: cr.customer.id })));

  const filteredCampaigns = allCampaigns.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (typeFilter !== 'all' && c.type !== typeFilter) return false;
    return true;
  });

  const availableTypes = [...new Set(allCampaigns.map(c => c.type))];

  const totals = filteredCampaigns.reduce(
    (acc, c) => ({ cost: acc.cost + c.cost, impressions: acc.impressions + c.impressions, clicks: acc.clicks + c.clicks, conversions: acc.conversions + c.conversions }),
    { cost: 0, impressions: 0, clicks: 0, conversions: 0 }
  );
  const prevTotals = dateRange.prevStartDate
    ? customerReports.flatMap(cr => cr.report.previousCampaigns || []).reduce(
        (acc, c) => ({ cost: acc.cost + c.cost, impressions: acc.impressions + c.impressions, clicks: acc.clicks + c.clicks, conversions: acc.conversions + c.conversions }),
        { cost: 0, impressions: 0, clicks: 0, conversions: 0 }
      )
    : undefined;

  const chartData = customerReports.map(cr => ({
    name: cr.customer.name.substring(0, 14),
    current: cr.report.campaigns.reduce((s, c) => s + c.cost, 0),
    previous: (cr.report.previousCampaigns || []).reduce((s, c) => s + c.cost, 0),
  }));

  const exportData = filteredCampaigns.flatMap(c => [
    { Hesab: c.customerName, Kampaniya: c.name, Növ: TYPE_LABELS[c.type] || c.type, Status: c.status, Etiketlər: c.labels.join(', '), 'Xərc ($)': c.cost.toFixed(2), Göstərilmə: c.impressions, Kliklər: c.clicks, 'CPC ($)': c.avgCpc.toFixed(2), Dönüşüm: c.conversions },
    ...(c.topKeywords?.map(k => ({ Hesab: c.customerName, Kampaniya: `  └ ${c.name}`, Növ: 'Keyword', Status: '', Etiketlər: k.text, 'Xərc ($)': k.cost.toFixed(2), Göstərilmə: k.impressions, Kliklər: k.clicks, 'CPC ($)': k.avgCpc.toFixed(2), Dönüşüm: 0 })) || []),
  ]);

  return (
    <div className="max-w-6xl page-enter">
      {/* Hero Header */}
      <div className="page-hero mb-5" style={{ background: 'linear-gradient(135deg, #0f172a, #1a2f4a)' }}>
        <div className="flex items-center gap-3">
          <div style={{ background: 'rgba(66,133,244,0.2)', borderRadius: 12, padding: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          </div>
          <div>
            <p style={{ color: '#60a5fa', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Reklam Analitikası</p>
            <h2 style={{ color: '#f8fafc', fontSize: 16, fontWeight: 700 }}>{t('google.title')}</h2>
          </div>
        </div>
        <div className="flex gap-2">
          {customerReports.length > 0 && <ExportButton data={exportData} filename="google-ads-report" accentColor="#4285F4" />}
          {status?.connected && (
            <button onClick={disconnect} className="px-3 py-2 text-xs rounded-lg transition-colors"
              style={{ color: '#fca5a5', border: '1px solid rgba(252,165,165,0.3)' }}>
              {t('google.disconnect')}
            </button>
          )}
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-xl text-xs" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2' }}>{error}</div>}

      {/* Not Connected */}
      {!status?.connected && step !== 'verify' && (
        <div className="rounded-2xl p-10 text-center" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          <h3 className="text-sm font-bold mb-1" style={{ color: '#0f172a' }}>{t('google.notConnected')}</h3>
          <p className="text-xs mb-5" style={{ color: '#94a3b8' }}>Google Ads hesabınızı bağlamaq üçün Google OAuth ilə giriş edin.</p>
          <button onClick={connectGoogle} disabled={connectLoading}
            className="btn-primary" style={{ background: '#4285F4' }}>
            {connectLoading ? t('common.loading') : t('google.connect')}
          </button>
        </div>
      )}

      {/* Verify */}
      {(step === 'verify' || (status?.connected && !status.verified)) && (
        <div className="bg-[#e8f0fe] border border-[#4285F4]/20 rounded-xl p-6 max-w-sm">
          <h3 className="font-semibold text-[#4285F4] mb-2">{t('google.verify')}</h3>
          <p className="text-xs text-gray-600 mb-4">{t('google.verifyInfo')}</p>
          {verifyError && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{verifyError}</div>}
          <input value={verifyCode} onChange={e => setVerifyCode(e.target.value)} placeholder="000000" maxLength={6}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-center text-lg tracking-widest font-bold outline-none focus:border-[#4285F4] mb-3" />
          <button onClick={verifyEmail} disabled={verifyLoading || verifyCode.length !== 6}
            className="w-full py-2 text-sm font-medium text-white rounded-lg bg-[#4285F4] disabled:opacity-50 mb-2">
            {verifyLoading ? t('common.loading') : t('google.verifyBtn')}
          </button>
          <button onClick={() => api.post('/google/resend-code').catch(() => {})} className="w-full text-xs text-[#4285F4] hover:underline">{t('google.resendCode')}</button>
        </div>
      )}

      {/* Connected & Verified */}
      {status?.connected && status.verified && (
        <>
          <div className="flex items-center gap-3 mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <span className="text-green-600">✓</span>
            <span className="text-xs text-green-700">{t('google.connected')} — {status.email}</span>
            {customers.length === 0 && (
              <button onClick={async () => {
                try {
                  const res = await api.post('/google/refresh-customers');
                  await loadStatus();
                  setError('');
                } catch (err: any) {
                  setError(err.response?.data?.error || 'Hesablar yenilənə bilmədi');
                }
              }} className="ml-auto px-3 py-1 text-xs font-medium text-[#4285F4] border border-[#4285F4] rounded-lg hover:bg-blue-50">
                🔄 Hesabları Yenilə
              </button>
            )}
          </div>

          {customers.length === 0 && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
              <p className="font-semibold mb-1">⚠ Heç bir Google Ads hesabı tapılmadı</p>
              <p>Yuxarıdakı "🔄 Hesabları Yenilə" düyməsinə bas. Əgər yenə boş gəlsə, developer token TEST modundadır — Google Ads API konsolundan BASIC access tələb et.</p>
            </div>
          )}

          {/* Account multi-select filter */}
          {customers.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Hesablar — {selectedCustomerIds.size}/{customers.length} seçilib
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedCustomerIds(new Set(customers.map(c => c.id)))} disabled={isAllSelected}
                    className="text-xs text-[#4285F4] hover:underline disabled:opacity-40">Hamısını seç</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={() => setSelectedCustomerIds(new Set())} disabled={selectedCustomerIds.size === 0}
                    className="text-xs text-gray-500 hover:underline disabled:opacity-40">Təmizlə</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {customers.map(c => {
                  const isSelected = selectedCustomerIds.has(c.id);
                  const cr = customerReports.find(r => r.customer.id === c.id);
                  const spend = cr ? cr.report.campaigns.reduce((s, camp) => s + camp.cost, 0) : null;
                  return (
                    <button key={c.id} onClick={() => toggleCustomer(c.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all ${isSelected ? 'bg-[#4285F4] text-white border-[#4285F4] shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-[#4285F4]'}`}>
                      <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-white border-white' : 'border-gray-300'}`}>
                        {isSelected && <span className="text-[#4285F4] text-xs font-bold">✓</span>}
                      </span>
                      <span className="font-medium">{c.name}</span>
                      <span className="opacity-70 text-xs">({c.id})</span>
                      {spend !== null && <span className={`text-xs font-semibold ${isSelected ? 'text-white/80' : 'text-[#34A853]'}`}>${spend.toFixed(0)}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Campaign filters */}
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 flex-wrap">
                <span className="text-xs text-gray-500">Status:</span>
                {(['all', 'ENABLED', 'PAUSED'] as StatusFilter[]).map(f => (
                  <button key={f} onClick={() => setStatusFilter(f)}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-all ${statusFilter === f
                      ? f === 'ENABLED' ? 'bg-green-600 text-white border-green-600' : f === 'PAUSED' ? 'bg-gray-500 text-white border-gray-500' : 'bg-[#4285F4] text-white border-[#4285F4]'
                      : 'bg-white text-gray-500 border-gray-200'}`}>
                    {f === 'all' ? 'Hamısı' : f === 'ENABLED' ? '● Aktiv' : '◌ Deaktiv'}
                  </button>
                ))}
                <span className="text-xs text-gray-500 ml-1">Növ:</span>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                  className="text-xs border border-gray-200 rounded-md px-2 py-1 outline-none focus:border-[#4285F4] bg-white">
                  <option value="all">Hamısı</option>
                  {availableTypes.map(tp => <option key={tp} value={tp}>{TYPE_LABELS[tp] || tp}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Date Range */}
          <div className="mb-6">
            <DateRangePicker value={dateRange} onChange={v => { setDateRange(v); setGlobalRange(v); }} onApply={fetchReport} accentColor="#4285F4" />
          </div>

          {loading && <div className="flex flex-col items-center justify-center py-16 gap-4"><div className="loading-spinner" style={{ borderTopColor: '#4285F4' }}/><span style={{ color: '#94a3b8', fontSize: 13 }}>{t('common.loading')}</span></div>}

          {customerReports.length > 0 && (
            <>
              {/* Summary metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <MetricsCard label={t('metrics.totalSpend')} value={totals.cost.toFixed(2)} previous={prevTotals?.cost} prefix="$" color="#4285F4" />
                <MetricsCard label={t('metrics.totalImpressions')} value={totals.impressions} previous={prevTotals?.impressions} color="#4285F4" />
                <MetricsCard label={t('metrics.totalClicks')} value={totals.clicks} previous={prevTotals?.clicks} color="#4285F4" />
                <MetricsCard label={t('metrics.totalConversions')} value={totals.conversions.toFixed(0)} previous={prevTotals?.conversions} color="#34A853" />
              </div>

              {/* Chart */}
              {chartData.length > 1 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Hesablara görə xərc ($)</h3>
                  <ComparisonChart data={chartData} metric="cost" type="bar" primaryColor="#4285F4" secondaryColor="#FBBC04"
                    showPrevious={!!dateRange.prevStartDate} valueFormatter={v => `$${v.toFixed(2)}`} />
                </div>
              )}

              {/* Campaign type breakdown */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(allCampaigns.reduce((acc, c) => { acc[c.type] = (acc[c.type] || 0) + c.cost; return acc; }, {} as Record<string, number>))
                    .map(([type, cost]) => (
                      <div key={type} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
                        style={{ borderColor: TYPE_COLORS[type] + '40', backgroundColor: TYPE_COLORS[type] + '10' }}>
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: TYPE_COLORS[type] }} />
                        <span className="text-xs text-gray-700">{TYPE_LABELS[type] || type}</span>
                        <span className="text-xs font-bold" style={{ color: TYPE_COLORS[type] }}>${cost.toFixed(2)}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Per account — expand/collapse */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  {customerReports.length} hesab · {filteredCampaigns.length} kampaniya
                </span>
                <div className="flex gap-2">
                  <button onClick={expandAll} className="text-xs text-[#4285F4] hover:underline">Hamısını aç ▼</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={collapseAll} className="text-xs text-gray-500 hover:underline">Hamısını bağla ▲</button>
                </div>
              </div>

              {customerReports.map(cr => {
                const isExpanded = expandedAccounts.has(cr.customer.id);
                const crCampaigns = cr.report.campaigns.filter(c => {
                  if (statusFilter !== 'all' && c.status !== statusFilter) return false;
                  if (typeFilter !== 'all' && c.type !== typeFilter) return false;
                  return true;
                });
                const totalCost = crCampaigns.reduce((s, c) => s + c.cost, 0);
                const totalImpr = crCampaigns.reduce((s, c) => s + c.impressions, 0);
                const totalClicks = crCampaigns.reduce((s, c) => s + c.clicks, 0);

                return (
                  <div key={cr.customer.id} className="mb-3 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Account header */}
                    <div className="bg-[#e8f0fe] px-5 py-3 border-b border-[#4285F4]/10 flex items-center justify-between cursor-pointer hover:bg-[#d2e3fc] transition-colors"
                      onClick={() => toggleAccount(cr.customer.id)}>
                      <div className="flex items-center gap-3">
                        <span className="text-[#4285F4] text-sm font-bold">{isExpanded ? '▼' : '▶'}</span>
                        <div>
                          <h3 className="font-semibold text-[#4285F4] text-sm">{cr.customer.name}</h3>
                          <span className="text-xs text-gray-500">ID: {cr.customer.id}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        <span>💰 <strong className="text-[#4285F4]">${totalCost.toFixed(2)}</strong></span>
                        <span>👁 {totalImpr.toLocaleString()}</span>
                        <span>🖱 {totalClicks.toLocaleString()}</span>
                        <span className="text-gray-400">{crCampaigns.length} kampaniya</span>
                      </div>
                    </div>

                    {/* Account-level Top 3 Keywords — always visible */}
                    {cr.report.accountTopKeywords && cr.report.accountTopKeywords.length > 0 && !isExpanded && (
                      <div className="px-5 py-2 bg-[#f0f6ff] border-b border-[#4285F4]/10 flex gap-4 flex-wrap">
                        <span className="text-xs font-semibold text-[#4285F4]">🔑 Top 3:</span>
                        {cr.report.accountTopKeywords.map((kw, i) => (
                          <span key={i} className="text-xs text-gray-700">
                            <span className="font-bold text-[#4285F4]">{i+1}.</span> "{kw.text}" — <strong>${kw.cost.toFixed(2)}</strong>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Campaigns — only when expanded */}
                    {isExpanded && (
                      crCampaigns.length === 0 ? (
                        <div className="text-center py-6 text-gray-400 text-xs">Kampaniya tapılmadı</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="px-4 py-2.5 text-left text-gray-500 font-medium min-w-[180px]">Kampaniya</th>
                                <th className="px-3 py-2.5 text-left text-gray-500 font-medium">Növ</th>
                                <th className="px-3 py-2.5 text-left text-gray-500 font-medium">Etiket</th>
                                <th className="px-3 py-2.5 text-right text-gray-500 font-medium">Xərc ($)</th>
                                <th className="px-3 py-2.5 text-right text-gray-500 font-medium">Göstərilmə</th>
                                <th className="px-3 py-2.5 text-right text-gray-500 font-medium">Klik</th>
                                <th className="px-3 py-2.5 text-right text-gray-500 font-medium">CTR</th>
                                <th className="px-3 py-2.5 text-right text-gray-500 font-medium">CPC ($)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {crCampaigns.map(c => {
                                const kwKey = `${cr.customer.id}-${c.id}`;
                                return (
                                  <>
                                    <tr key={kwKey}
                                      className={`border-t border-gray-50 hover:bg-blue-50/30 transition-colors ${c.topKeywords?.length ? 'cursor-pointer' : ''}`}
                                      onClick={() => c.topKeywords?.length && toggleKeywords(kwKey)}>
                                      <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2">
                                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.status === 'ENABLED' ? 'bg-green-500' : 'bg-gray-400'}`} />
                                          <span className="font-medium text-gray-800 truncate max-w-[160px]" title={c.name}>{c.name}</span>
                                          {c.topKeywords?.length ? <span className="text-gray-400">{expandedKeywords.has(kwKey) ? '▲' : '▼'}</span> : null}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2.5">
                                        <span className="px-2 py-0.5 text-xs font-medium text-white rounded" style={{ backgroundColor: TYPE_COLORS[c.type] || '#9CA3AF' }}>
                                          {TYPE_LABELS[c.type] || c.type}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2.5 text-gray-500">{c.labels.length > 0 ? c.labels.join(', ') : '—'}</td>
                                      <td className="px-3 py-2.5 text-right font-semibold text-[#4285F4]">${c.cost.toFixed(2)}</td>
                                      <td className="px-3 py-2.5 text-right text-gray-700">{c.impressions.toLocaleString()}</td>
                                      <td className="px-3 py-2.5 text-right text-gray-700">{c.clicks.toLocaleString()}</td>
                                      <td className="px-3 py-2.5 text-right text-gray-700">{(c.ctr * 100).toFixed(2)}%</td>
                                      <td className="px-3 py-2.5 text-right text-gray-700">${c.avgCpc.toFixed(2)}</td>
                                    </tr>
                                    {expandedKeywords.has(kwKey) && c.topKeywords && c.topKeywords.length > 0 && (
                                      <tr key={`${kwKey}-kw`} className="bg-[#f0f6ff]">
                                        <td colSpan={8} className="px-6 py-3">
                                          <div className="text-xs font-semibold text-[#4285F4] mb-2">🔑 Top 3 Açar söz</div>
                                          <div className="flex flex-col gap-1.5">
                                            {c.topKeywords.map((kw, i) => (
                                              <div key={i} className="flex items-center gap-4 bg-white rounded-lg px-3 py-2 border border-[#4285F4]/10">
                                                <span className="w-5 h-5 rounded-full bg-[#4285F4] text-white flex items-center justify-center text-xs font-bold">{i + 1}</span>
                                                <span className="font-medium text-gray-800 flex-1">"{kw.text}"</span>
                                                <span className="text-gray-500">Xərc: <strong className="text-[#4285F4]">${kw.cost.toFixed(2)}</strong></span>
                                                <span className="text-gray-500">Klik: <strong>{kw.clicks.toLocaleString()}</strong></span>
                                                <span className="text-gray-500">CPC: <strong>${kw.avgCpc.toFixed(2)}</strong></span>
                                              </div>
                                            ))}
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-[#e8f0fe] border-t-2 border-[#4285F4]/20 text-xs font-semibold">
                                <td className="px-4 py-2.5 text-gray-700" colSpan={3}>Cəmi ({crCampaigns.length})</td>
                                <td className="px-3 py-2.5 text-right text-[#4285F4]">${totalCost.toFixed(2)}</td>
                                <td className="px-3 py-2.5 text-right text-gray-700">{totalImpr.toLocaleString()}</td>
                                <td className="px-3 py-2.5 text-right text-gray-700">{totalClicks.toLocaleString()}</td>
                                <td className="px-3 py-2.5" colSpan={2}></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )
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
