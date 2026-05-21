import { useState, useEffect } from 'react';
import api from '../services/api';
import DateRangePicker, { DateRangeValue } from '../components/common/DateRangePicker';
import { useDateRange } from '../context/DateRangeContext';
import { format, subDays } from 'date-fns';

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
const today = new Date();

const IconTikTok = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
    <path d="M34 6h-5v22.5a5.5 5.5 0 11-5.5-5.5c.32 0 .63.03.93.08V17.5A11.5 11.5 0 1034 29V17.7A17.9 17.9 0 0042 20v-5.9A12.1 12.1 0 0134 6z" fill="white"/>
    <path d="M36 4h-5v22.5a5.5 5.5 0 11-5.5-5.5c.32 0 .63.03.93.08V15.5A11.5 11.5 0 1036 27V15.7A17.9 17.9 0 0044 18v-5.9A12.1 12.1 0 0136 4z" fill="#69C9D0" opacity="0.7"/>
    <path d="M32 4h-5v22.5a5.5 5.5 0 11-5.5-5.5c.32 0 .63.03.93.08V15.5A11.5 11.5 0 1032 27V15.7A17.9 17.9 0 0040 18v-5.9A12.1 12.1 0 0132 4z" fill="#EE1D52" opacity="0.7"/>
    <path d="M30 6h-5v22.5a5.5 5.5 0 11-5.5-5.5c.32 0 .63.03.93.08V17.5A11.5 11.5 0 1030 29V17.7A17.9 17.9 0 0038 20v-5.9A12.1 12.1 0 0130 6z" fill="white"/>
  </svg>
);

interface Advertiser { id: string; name: string; }
interface Campaign {
  id: string; name: string; status: string;
  spend: number; impressions: number; clicks: number; cpc: number;
  advertiserId: string; advertiserName: string;
}

const fmtMoney = (v: number) => v ? '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
const fmtNum = (v: number) => v ? v.toLocaleString('en-US') : '—';

export default function TikTokAdsPage() {
  const { range: globalRange, setRange: setGlobalRange } = useDateRange();
  const [connected, setConnected] = useState(false);
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualId, setManualId] = useState('');
  const [addingId, setAddingId] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeValue>(globalRange);

  useEffect(() => {
    loadStatus(true);
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected')) loadStatus(false);
    if (params.get('error')) setError(`OAuth xətası: ${params.get('error')}`);
  }, []);

  async function loadStatus(autoFetch = false) {
    try {
      const res = await api.get('/tiktok/status');
      setConnected(res.data.connected);
      if (res.data.connected) {
        const advRes = await api.get('/tiktok/advertisers');
        const advs: Advertiser[] = advRes.data.advertisers || [];
        setAdvertisers(advs);
        const ids = new Set<string>(advs.map((a: Advertiser) => a.id));
        setSelectedIds(ids);
        if (autoFetch && ids.size > 0) {
          setLoading(true); setError(''); setCampaigns([]);
          try {
            const results = await Promise.all([...ids].map(async id => {
              const r = await api.post('/tiktok/report', { advertiserId: id, ...dateRange });
              return r.data.campaigns as Campaign[];
            }));
            setCampaigns(results.flat());
          } catch (e: any) {
            setError(e.response?.data?.error || 'Xəta baş verdi');
          } finally { setLoading(false); }
        }
      }
    } catch {}
  }

  async function connect() {
    setConnectLoading(true);
    try {
      const res = await api.get('/tiktok/auth-url');
      window.location.href = res.data.url;
    } catch (e: any) {
      setError(e.response?.data?.error || 'Xəta baş verdi');
      setConnectLoading(false);
    }
  }

  async function disconnect() {
    await api.delete('/tiktok/disconnect');
    setConnected(false); setAdvertisers([]); setCampaigns([]);
  }

  async function addManualId() {
    const id = manualId.trim();
    if (!id) return;
    setAddingId(true);
    try {
      await api.post('/tiktok/advertisers/add', { advertiserId: id });
      setManualId('');
      await loadStatus();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Xəta baş verdi');
    } finally { setAddingId(false); }
  }

  async function fetchReport() {
    if (!selectedIds.size) { setError('Ən az bir hesab seçin'); return; }
    setLoading(true); setError(''); setCampaigns([]);
    try {
      const results = await Promise.all([...selectedIds].map(async id => {
        const res = await api.post('/tiktok/report', { advertiserId: id, ...dateRange });
        return res.data.campaigns as Campaign[];
      }));
      setCampaigns(results.flat());
    } catch (e: any) {
      setError(e.response?.data?.error || 'Xəta baş verdi');
    } finally { setLoading(false); }
  }

  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);

  return (
    <div className="max-w-5xl page-enter">
      {/* Hero Header */}
      <div className="page-hero mb-5" style={{ background: 'linear-gradient(135deg, #0a0a0a, #1a1a2e)' }}>
        <div className="flex items-center gap-3">
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 10 }}>
            <IconTikTok />
          </div>
          <div>
            <p style={{ color: '#a78bfa', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Reklam Analitikası</p>
            <h2 style={{ color: '#f8fafc', fontSize: 16, fontWeight: 700 }}>TikTok Ads</h2>
          </div>
        </div>
        {connected && (
          <button onClick={disconnect} className="px-3 py-2 text-xs rounded-lg transition-colors"
            style={{ color: '#fca5a5', border: '1px solid rgba(252,165,165,0.3)' }}>
            Ayır
          </button>
        )}
      </div>

      {error && <div className="mb-4 p-3 rounded-lg text-xs" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2' }}>{error}</div>}

      {/* Not connected */}
      {!connected && (
        <div className="rounded-2xl p-10 text-center" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: '#000' }}>
            <IconTikTok />
          </div>
          <h3 className="text-base font-bold mb-2" style={{ color: '#0f172a' }}>TikTok Ads qoşulmayıb</h3>
          <p className="text-xs mb-6" style={{ color: '#64748b' }}>TikTok Business hesabınızı bağlayın.</p>
          <button onClick={connect} disabled={connectLoading}
            className="px-6 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition-colors"
            style={{ background: '#000' }}>
            {connectLoading ? 'Yüklənir...' : 'TikTok ilə Bağla'}
          </button>
        </div>
      )}

      {/* Connected */}
      {connected && (
        <>
          {/* Advertiser selection */}
          <div className="rounded-2xl p-4 mb-5" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#64748b' }}>
              {advertisers.length > 0 ? `Hesablar — ${selectedIds.size}/${advertisers.length} seçilib` : 'Reklam Hesabları'}
            </p>
            {advertisers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {advertisers.map(a => {
                  const sel = selectedIds.has(a.id);
                  return (
                    <button key={a.id} onClick={() => {
                      setSelectedIds(prev => { const n = new Set(prev); sel ? n.delete(a.id) : n.add(a.id); return n; });
                    }} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={sel ? { background: '#000', color: '#fff' } : { background: '#f1f5f9', color: '#475569' }}>
                      {a.name}
                    </button>
                  );
                })}
              </div>
            )}
            {advertisers.length === 0 && (
              <p className="text-xs mb-3" style={{ color: '#94a3b8' }}>
                Hesab avtomatik tapılmadı. TikTok Ads Manager-dən Advertiser ID-ni əlavə edin.
              </p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={manualId}
                onChange={e => setManualId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addManualId()}
                placeholder="Advertiser ID (məs: 7123456789012345678)"
                className="flex-1 px-3 py-2 text-xs rounded-lg outline-none"
                style={{ border: '1px solid #e2e8f0', color: '#0f172a' }}
              />
              <button onClick={addManualId} disabled={addingId || !manualId.trim()}
                className="px-4 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-50"
                style={{ background: '#000' }}>
                {addingId ? '...' : 'Əlavə et'}
              </button>
            </div>
          </div>

          {/* Date + fetch */}
          <div className="rounded-2xl p-4 mb-5" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
            <DateRangePicker value={dateRange} onChange={v => { setDateRange(v); setGlobalRange(v); }} onApply={() => {}} accentColor="#000" />
            <button onClick={fetchReport} disabled={loading}
              className="mt-3 px-5 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-50"
              style={{ background: '#000' }}>
              {loading ? 'Yüklənir...' : 'Hesabatı Yüklə'}
            </button>
          </div>

          {/* Summary */}
          {campaigns.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-4 mb-5">
                {[
                  { label: 'Ümumi Xərc', value: fmtMoney(totalSpend) },
                  { label: 'Göstərilmə', value: fmtNum(totalImpressions) },
                  { label: 'Kliklər', value: fmtNum(totalClicks) },
                ].map(m => (
                  <div key={m.label} className="rounded-2xl p-4" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
                    <p className="text-xs mb-1" style={{ color: '#94a3b8' }}>{m.label}</p>
                    <p className="text-xl font-bold" style={{ color: '#0f172a' }}>{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Campaigns table */}
              <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
                <div className="px-5 py-3" style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>
                    Kampaniyalar ({campaigns.length})
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        {['Kampaniya', 'Hesab', 'Status', 'Xərc', 'Göstərilmə', 'Kliklər', 'CPC'].map(h => (
                          <th key={h} className="px-4 py-3 text-left font-semibold" style={{ color: '#64748b' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map(c => (
                        <tr key={c.id} style={{ borderTop: '1px solid #f8fafc' }}
                          className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium" style={{ color: '#0f172a', maxWidth: 200 }}>
                            <span className="block truncate">{c.name}</span>
                          </td>
                          <td className="px-4 py-3" style={{ color: '#64748b' }}>{c.advertiserName}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{ background: c.status === 'CAMPAIGN_STATUS_ENABLE' ? '#f0fdf4' : '#f8fafc',
                                       color: c.status === 'CAMPAIGN_STATUS_ENABLE' ? '#16a34a' : '#64748b' }}>
                              {c.status === 'CAMPAIGN_STATUS_ENABLE' ? 'Aktiv' : 'Deaktiv'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold" style={{ color: '#0f172a' }}>{fmtMoney(c.spend)}</td>
                          <td className="px-4 py-3" style={{ color: '#64748b' }}>{fmtNum(c.impressions)}</td>
                          <td className="px-4 py-3" style={{ color: '#64748b' }}>{fmtNum(c.clicks)}</td>
                          <td className="px-4 py-3" style={{ color: '#64748b' }}>{fmtMoney(c.cpc)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
