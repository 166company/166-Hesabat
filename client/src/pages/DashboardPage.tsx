import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDateRange } from '../context/DateRangeContext';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import api from '../services/api';
import DateRangePicker from '../components/common/DateRangePicker';

interface NewsItem { title: string; link: string; pubDate: string; thumbnail: string | null; }

function NewsWidget() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/news').then(r => {
      setNews(r.data.items || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'İndicə';
    if (h < 24) return `${h} saat əvvəl`;
    return `${Math.floor(h / 24)} gün əvvəl`;
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', flex: 1 }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'pulse-dot 2s infinite' }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Digital Marketing Xəbərləri</span>
        </div>
        <a href="https://www.searchenginejournal.com" target="_blank" rel="noreferrer"
          style={{ fontSize: 10, color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>SEJ →</a>
      </div>

      {loading && (
        <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 12 }}>
          <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Yüklənir...
        </div>
      )}

      {!loading && news.length === 0 && (
        <div style={{ padding: 16, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
          Xəbərlər yüklənmədi
        </div>
      )}

      {!loading && news.map((item, i) => (
        <a key={i} href={item.link} target="_blank" rel="noreferrer" style={{
          display: 'block', padding: '10px 14px', textDecoration: 'none',
          borderBottom: i < news.length - 1 ? '1px solid #f8fafc' : 'none',
          transition: 'background 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', lineHeight: 1.4, marginBottom: 3 }}>
            {item.title.length > 70 ? item.title.slice(0, 70) + '…' : item.title}
          </p>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>{timeAgo(item.pubDate)}</span>
        </a>
      ))}
    </div>
  );
}

const MetaAnim = () => (
  <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
    <style>{`@keyframes md1{0%,100%{cy:28}50%{cy:18}}@keyframes md2{0%,100%{cy:24}50%{cy:22}}@keyframes md3{0%,100%{cy:22}50%{cy:26}}`}</style>
    <circle cx="24" cy="24" r="22" fill="#eff6ff"/>
    <path d="M6 28 Q18 18 30 24 Q42 30 48 22" stroke="#1877F2" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.3"/>
    <circle cx="12" cy="28" r="3" fill="#1877F2" style={{animation:'md1 2s ease-in-out infinite'}}/>
    <circle cx="24" cy="24" r="3" fill="#1877F2" style={{animation:'md2 2s ease-in-out infinite 0.3s'}}/>
    <circle cx="36" cy="22" r="3" fill="#1877F2" style={{animation:'md3 2s ease-in-out infinite 0.6s'}}/>
  </svg>
);
const GoogleAnim = () => (
  <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
    <style>{`@keyframes gb1{0%,100%{height:10;y:26}50%{height:18;y:18}}@keyframes gb2{0%,100%{height:18;y:18}50%{height:26;y:10}}@keyframes gb3{0%,100%{height:14;y:22}50%{height:10;y:26}}@keyframes gb4{0%,100%{height:22;y:14}50%{height:16;y:20}}`}</style>
    <circle cx="24" cy="24" r="22" fill="#f0f7ff"/>
    <rect x="8" width="6" rx="2" fill="#4285F4" height="10" y="26" style={{animation:'gb1 1.6s ease-in-out infinite'}}/>
    <rect x="16" width="6" rx="2" fill="#34A853" height="18" y="18" style={{animation:'gb2 1.6s ease-in-out infinite 0.2s'}}/>
    <rect x="24" width="6" rx="2" fill="#FBBC05" height="14" y="22" style={{animation:'gb3 1.6s ease-in-out infinite 0.4s'}}/>
    <rect x="32" width="6" rx="2" fill="#EA4335" height="22" y="14" style={{animation:'gb4 1.6s ease-in-out infinite 0.1s'}}/>
  </svg>
);
const TikTokAnim = () => (
  <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
    <style>{`@keyframes ttp{0%,100%{opacity:1;r:3}50%{opacity:0.6;r:4}}`}</style>
    <circle cx="24" cy="24" r="22" fill="#111"/>
    <path d="M26 14h3a5 5 0 004 4v3a8 8 0 01-4-1.2V26a6 6 0 11-4-5.7V23a3 3 0 103 3v-12z" fill="white"/>
    <circle cx="36" cy="14" r="3" fill="#ee1d52" style={{animation:'ttp 1.8s ease-in-out infinite'}}/>
    <circle cx="34" cy="14" r="3" fill="#69c9d0" style={{animation:'ttp 1.8s ease-in-out infinite 0.3s'}}/>
  </svg>
);
const FinanceAnim = () => (
  <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
    <style>{`@keyframes fl{0%{stroke-dashoffset:100}100%{stroke-dashoffset:0}}@keyframes fd{0%,100%{r:3}50%{r:5}}`}</style>
    <circle cx="24" cy="24" r="22" fill="#f0fdf4"/>
    <polyline points="6,36 14,26 22,30 30,18 38,22 44,12" stroke="#16a34a" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" style={{animation:'fl 2s ease-in-out infinite alternate'}}/>
    <circle cx="30" cy="18" r="3" fill="#16a34a" style={{animation:'fd 2s ease-in-out infinite'}}/>
  </svg>
);
const ChatAnim = () => (
  <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
    <style>{`@keyframes cb{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}@keyframes cd{0%,100%{opacity:0.3}50%{opacity:1}}`}</style>
    <circle cx="24" cy="24" r="22" fill="#faf5ff"/>
    <rect x="8" y="12" width="24" height="14" rx="5" fill="#7c3aed" opacity="0.9" style={{animation:'cb 2s ease-in-out infinite'}}/>
    <polygon points="14,26 10,32 20,26" fill="#7c3aed" opacity="0.9"/>
    <circle cx="15" cy="19" r="1.5" fill="white" style={{animation:'cd 1.2s ease-in-out infinite'}}/>
    <circle cx="20" cy="19" r="1.5" fill="white" style={{animation:'cd 1.2s ease-in-out infinite 0.2s'}}/>
    <circle cx="25" cy="19" r="1.5" fill="white" style={{animation:'cd 1.2s ease-in-out infinite 0.4s'}}/>
  </svg>
);
const HeroAnimation = () => (
  <svg width="150" height="90" viewBox="0 0 160 100" fill="none">
    <style>{`@keyframes hb1{0%,100%{height:30;y:55}50%{height:50;y:35}}@keyframes hb2{0%,100%{height:50;y:35}50%{height:70;y:15}}@keyframes hb3{0%,100%{height:40;y:45}50%{height:30;y:55}}@keyframes hb4{0%,100%{height:65;y:20}50%{height:45;y:40}}@keyframes hb5{0%,100%{height:35;y:50}50%{height:55;y:30}}@keyframes hl{0%{stroke-dashoffset:200}100%{stroke-dashoffset:0}}`}</style>
    <rect x="10" width="18" rx="4" fill="#3b82f6" height="30" y="55" style={{animation:'hb1 2s ease-in-out infinite'}} opacity="0.9"/>
    <rect x="34" width="18" rx="4" fill="#60a5fa" height="50" y="35" style={{animation:'hb2 2s ease-in-out infinite 0.3s'}} opacity="0.9"/>
    <rect x="58" width="18" rx="4" fill="#3b82f6" height="40" y="45" style={{animation:'hb3 2s ease-in-out infinite 0.6s'}} opacity="0.9"/>
    <rect x="82" width="18" rx="4" fill="#1d4ed8" height="65" y="20" style={{animation:'hb4 2s ease-in-out infinite 0.1s'}} opacity="0.9"/>
    <rect x="106" width="18" rx="4" fill="#60a5fa" height="35" y="50" style={{animation:'hb5 2s ease-in-out infinite 0.5s'}} opacity="0.9"/>
    <line x1="5" y1="88" x2="155" y2="88" stroke="#e2e8f0" strokeWidth="1.5"/>
    <polyline points="10,70 34,55 58,62 82,38 106,52 135,35" stroke="#f59e0b" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="200" style={{animation:'hl 2.5s ease-in-out infinite alternate'}}/>
  </svg>
);

const SparkLine = () => (
  <svg width="100%" height="60" viewBox="0 0 200 60" preserveAspectRatio="none" fill="none">
    <style>{`@keyframes sp{0%{stroke-dashoffset:300}100%{stroke-dashoffset:0}}@keyframes spf{0%{opacity:0}100%{opacity:1}}`}</style>
    <defs>
      <linearGradient id="spGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3"/>
        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
      </linearGradient>
    </defs>
    <path d="M0,45 C20,40 30,20 50,25 C70,30 80,10 100,15 C120,20 130,35 150,30 C170,25 185,10 200,8" stroke="#3b82f6" strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="300" style={{animation:'sp 2s ease-out forwards'}}/>
    <path d="M0,45 C20,40 30,20 50,25 C70,30 80,10 100,15 C120,20 130,35 150,30 C170,25 185,10 200,8 L200,60 L0,60 Z" fill="url(#spGrad)" style={{animation:'spf 2s ease-out forwards'}}/>
  </svg>
);

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
        {time.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
        {time.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { range, setRange } = useDateRange();
  const [spend, setSpend] = useState({ google: 0, meta: 0, tiktok: 0, total: 0 });
  const [spendLoading, setSpendLoading] = useState(false);

  function fetchSpend(r = range) {
    setSpendLoading(true);
    api.get('/dashboard/summary', { params: { startDate: r.startDate, endDate: r.endDate } })
      .then(res => setSpend(res.data))
      .catch(() => {})
      .finally(() => setSpendLoading(false));
  }

  useEffect(() => { fetchSpend(); }, [range.startDate, range.endDate]);

  const platformSpend = spend;

  const cards = [
    { title: 'Meta Ads',    description: t('dashboard.metaDesc'),    to: '/meta-ads',      accent: '#1877F2', bg: '#eff6ff', Anim: MetaAnim,    spend: spend.meta },
    { title: 'Google Ads',  description: t('dashboard.googleDesc'),  to: '/google-ads',    accent: '#4285F4', bg: '#f0f7ff', Anim: GoogleAnim,  spend: spend.google },
    { title: 'TikTok Ads',  description: t('dashboard.tiktokDesc'),  to: '/tiktok-ads',    accent: '#111111', bg: '#f5f5f5', Anim: TikTokAnim,  spend: spend.tiktok },
    { title: t('dashboard.financeTitle'), description: t('dashboard.financeDesc'), to: '/report-table', accent: '#16a34a', bg: '#f0fdf4', Anim: FinanceAnim, spend: null },
    { title: t('dashboard.chatTitle'),    description: t('dashboard.chatDesc'),    to: '/chat',         accent: '#7c3aed', bg: '#faf5ff', Anim: ChatAnim,    spend: null },
  ];


  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse-glow{0%,100%{box-shadow:0 0 0 0 rgba(22,163,74,0.4)}50%{box-shadow:0 0 0 6px rgba(22,163,74,0)}}
        .dash-card{transition:box-shadow 0.2s,transform 0.2s;}
        .dash-card:hover{box-shadow:0 10px 28px rgba(0,0,0,0.09);transform:translateY(-2px);}
      `}</style>

      {/* Left: Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Hero */}
        <div className="rounded-2xl mb-4 overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)', animation: 'fadeUp 0.4s ease-out' }}>
          <div className="flex items-center justify-between px-7 py-5">
            <div>
              <p style={{ color: '#60a5fa', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4 }}>{t('dashboard.welcome')}</p>
              <h2 style={{ color: '#f8fafc', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{user?.name}</h2>
              <p style={{ color: '#94a3b8', fontSize: 13 }}>{t('dashboard.subtitle')}</p>
            </div>
            <HeroAnimation />
          </div>
        </div>

        {/* Date range picker */}
        <div style={{ marginBottom: 14, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <DateRangePicker
              value={range}
              onChange={setRange}
              onApply={() => fetchSpend()}
              accentColor="#0f172a"
            />
            {spendLoading && <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>Yüklənir...</span>}
          </div>
        </div>

        {/* Cards 3-col grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {cards.map((c, i) => (
            <Link key={c.to} to={c.to} className="dash-card block rounded-2xl p-5"
              style={{ background: '#fff', border: '1px solid #e2e8f0', textDecoration: 'none', animation: `fadeUp 0.4s ease-out ${0.08 + i * 0.07}s both` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <c.Anim />
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginTop: 2 }}>
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{c.title}</h3>
              <p style={{ fontSize: 11, lineHeight: 1.6, color: '#64748b', marginBottom: 10 }}>{c.description}</p>
              {c.spend != null && (
                <div style={{ fontSize: 15, fontWeight: 800, color: c.accent, marginBottom: 8 }}>
                  {spendLoading ? '...' : c.spend > 0 ? `$${c.spend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                </div>
              )}
              <div style={{ height: 2, borderRadius: 2, background: c.bg }}>
                <div style={{ height: 2, borderRadius: 2, background: c.accent,
                  width: c.spend != null && spend.total > 0 ? `${Math.min(100, (c.spend / spend.total) * 100)}%` : '33%',
                  transition: 'width 0.6s ease' }} />
              </div>
            </Link>
          ))}
        </div>

        {/* Info bar */}
        <div className="mt-4 rounded-xl px-5 py-3 flex items-center gap-3"
          style={{ background: 'linear-gradient(90deg,#f0fdf4,#f8fafc)', border: '1px solid #d1fae5', animation: 'fadeUp 0.4s ease-out 0.44s both' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block', boxShadow: '0 0 8px #16a34a', animation: 'pulse-glow 2s ease-in-out infinite' }} />
          <p style={{ fontSize: 12, color: '#64748b' }}>{t('dashboard.infoBar')}</p>
        </div>
      </div>

      {/* Right: Decorative panel */}
      <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeUp 0.4s ease-out 0.2s both' }}>

        {/* Live Clock */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, textAlign: 'center' }}>Bakı Vaxtı</div>
          <LiveClock />
        </div>

        {/* Sparkline */}
        <div style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a5f)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, overflow: 'hidden' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Aktivlik</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', marginBottom: 10 }}>Analitika</div>
          <SparkLine />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            {['B', 'Ç', 'Ş', 'B', 'C', 'Ş', 'B'].map((d, i) => (
              <span key={i} style={{ fontSize: 10, color: '#475569' }}>{d}</span>
            ))}
          </div>
        </div>

        {/* Donut chart - Platform payı */}
        {(() => {
          const C = 251;
          const { google, meta, tiktok } = platformSpend;
          const total = google + meta + tiktok || 1;
          const gArc = Math.round((google / total) * C);
          const mArc = Math.round((meta / total) * C);
          const tArc = Math.round((tiktok / total) * C);
          const gPct = Math.round((google / total) * 100);
          const mPct = Math.round((meta / total) * 100);
          const tPct = 100 - gPct - mPct;
          const platforms = [
            { label: 'Google', pct: gPct, arc: gArc, offset: 0,            color: '#4285F4' },
            { label: 'Meta',   pct: mPct, arc: mArc, offset: -gArc,        color: '#1877F2' },
            { label: 'TikTok', pct: tPct, arc: tArc, offset: -(gArc+mArc), color: '#111' },
          ];
          return (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Platforma Payı</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="30" fill="none" stroke="#f1f5f9" strokeWidth="14"/>
                  {platforms.map((p, i) => (
                    <circle key={p.label} cx="40" cy="40" r="30" fill="none" stroke={p.color} strokeWidth="14"
                      strokeLinecap="butt"
                      strokeDasharray={`${p.arc} ${C}`}
                      strokeDashoffset={p.offset}
                      style={{ transformOrigin: 'center', transform: 'rotate(-90deg)', transition: 'stroke-dasharray 0.8s ease' + (i > 0 ? ` ${i * 0.2}s` : '') }}/>
                  ))}
                  <text x="40" y="44" textAnchor="middle" style={{fontSize:10, fontWeight:800, fill:'#0f172a'}}>
                    {total > 1 ? `$${Math.round(total/1000)}k` : '—'}
                  </text>
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  {platforms.map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: '#475569', flex: 1 }}>{item.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{item.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        <NewsWidget />
      </div>
    </div>
  );
}
