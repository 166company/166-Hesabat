import { useState, useEffect } from 'react';
import api from '../services/api';
import DateRangePicker, { DateRangeValue } from '../components/common/DateRangePicker';
import { format, subDays } from 'date-fns';

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
const today = new Date();

const IconTikTok = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
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
  const [connected, setConnected] = useState(false);
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    startDate: fmt(subDays(today, 29)),
    endDate: fmt(today),
  });

  useEffect(() => {
    loadStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected')) loadStatus();
    if (params.get('error')) setError(`OAuth xətası: ${params.get('error')}`);
  }, []);

  async function loadStatus() {
    try {
      const res = await api.get('/tiktok/status');
      setConnected(res.data.connected);
      if (res.data.connected) {
        const advRes = await api.get('/tiktok/advertisers');
        setAdvertisers(advRes.data.advertisers || []);
        setSelectedIds(new Set((advRes.data.advertisers || []).map((a: Advertiser) => a.id)));
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
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: '#000' }}>
            <IconTikTok />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#94a3b8' }}>Reklam Analitikası</p>
            <h2 className="text-base font-bold" style={{ color: '#0f172a' }}>TikTok Ads</h2>
          </div>
        </div>
        {connected && (
          <button onClick={disconnect} className="px-3 py-2 text-xs rounded-lg transition-colors"
            style={{ color: '#dc2626', border: '1px solid #fee2e2' }}>
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
          {advertisers.length > 0 && (
            <div className="rounded-2xl p-4 mb-5" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#64748b' }}>
                Hesablar — {selectedIds.size}/{advertisers.length} seçilib
              </p>
              <div className="flex flex-wrap gap-2">
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
            </div>
          )}

          {/* Date + fetch */}
          <div className="rounded-2xl p-4 mb-5" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
            <DateRangePicker value={dateRange} onChange={setDateRange} onApply={() => {}} accentColor="#000" />
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
