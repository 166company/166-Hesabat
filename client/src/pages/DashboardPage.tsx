import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const cards = [
    {
      title: 'Meta Ads',
      description: t('dashboard.metaDesc'),
      to: '/meta-ads',
      accent: '#1877F2',
      bg: '#eff6ff',
      label: 'META',
    },
    {
      title: 'Google Ads',
      description: t('dashboard.googleDesc'),
      to: '/google-ads',
      accent: '#4285F4',
      bg: '#f0f7ff',
      label: 'GOOGLE',
    },
    {
      title: t('dashboard.financeTitle'),
      description: t('dashboard.financeDesc'),
      to: '/report-table',
      accent: '#16a34a',
      bg: '#f0fdf4',
      label: t('dashboard.financeLabel'),
    },
    {
      title: t('dashboard.chatTitle'),
      description: t('dashboard.chatDesc'),
      to: '/chat',
      accent: '#7c3aed',
      bg: '#faf5ff',
      label: 'CHAT',
    },
  ];

  return (
    <div className="max-w-4xl">
      {/* Welcome */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#94a3b8' }}>
          {t('dashboard.welcome')}
        </p>
        <h2 className="text-2xl font-bold" style={{ color: '#0f172a' }}>
          {user?.name}
        </h2>
        <p className="text-sm mt-1" style={{ color: '#64748b' }}>
          {t('dashboard.subtitle')}
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 gap-4">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="block rounded-2xl p-6 transition-all duration-200 group"
            style={{ background: '#ffffff', border: '1px solid #e2e8f0', textDecoration: 'none' }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
              el.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.boxShadow = 'none';
              el.style.transform = 'translateY(0)';
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="px-2 py-1 rounded-md text-xs font-bold tracking-widest"
                style={{ background: c.bg, color: c.accent }}>
                {c.label}
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c.accent} strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
            <h3 className="text-base font-bold mb-2" style={{ color: '#0f172a' }}>{c.title}</h3>
            <p className="text-xs leading-relaxed" style={{ color: '#64748b' }}>{c.description}</p>
            <div className="mt-4 h-0.5 rounded-full" style={{ background: c.bg }}>
              <div className="h-0.5 rounded-full w-1/3" style={{ background: c.accent }} />
            </div>
          </Link>
        ))}
      </div>

      {/* Info bar */}
      <div className="mt-6 rounded-xl px-5 py-4 flex items-center gap-3"
        style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}>
        <div className="w-2 h-2 rounded-full" style={{ background: '#16a34a' }} />
        <p className="text-xs" style={{ color: '#64748b' }}>
          {t('dashboard.infoBar')}
        </p>
      </div>
    </div>
  );
}
