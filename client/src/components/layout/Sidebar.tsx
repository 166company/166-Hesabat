import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const IconDashboard = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);
const IconMeta = () => (
  <svg width="18" height="11" viewBox="0 0 74 46" fill="none">
    <path d="M0 23C0 10 8 0 18 0C25 0 30 5 33 12C36 19 37 26 37 33C37 26 38 19 41 12C44 5 49 0 56 0C66 0 74 10 74 23C74 36 66 46 56 46C49 46 44 41 41 34C38 27 37 23 37 23C37 23 36 27 33 34C30 41 25 46 18 46C8 46 0 36 0 23Z" fill="#1877F2"/>
  </svg>
);
const IconGoogle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);
const IconTable = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18"/>
  </svg>
);
const IconTikTok = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" fill="none">
    <path d="M30 6h-5v22.5a5.5 5.5 0 11-5.5-5.5c.32 0 .63.03.93.08V17.5A11.5 11.5 0 1030 29V17.7A17.9 17.9 0 0038 20v-5.9A12.1 12.1 0 0130 6z" fill="white"/>
    <path d="M32 4h-5v22.5a5.5 5.5 0 11-5.5-5.5c.32 0 .63.03.93.08V15.5A11.5 11.5 0 1032 27V15.7A17.9 17.9 0 0040 18v-5.9A12.1 12.1 0 0132 4z" fill="#EE1D52" opacity="0.8"/>
    <path d="M34 6h-5v22.5a5.5 5.5 0 11-5.5-5.5c.32 0 .63.03.93.08V17.5A11.5 11.5 0 1034 29V17.7A17.9 17.9 0 0042 20v-5.9A12.1 12.1 0 0134 6z" fill="#69C9D0" opacity="0.8"/>
  </svg>
);
const IconChat = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
);

const AnimatedLogo = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <style>{`
      @keyframes bar1 { 0%,100%{height:8px;y:16px} 50%{height:14px;y:10px} }
      @keyframes bar2 { 0%,100%{height:14px;y:10px} 50%{height:20px;y:4px} }
      @keyframes bar3 { 0%,100%{height:10px;y:14px} 50%{height:8px;y:16px} }
      @keyframes bar4 { 0%,100%{height:18px;y:6px} 50%{height:12px;y:12px} }
    `}</style>
    <rect x="2" width="4" height="8" y="16" rx="1.5" fill="#3b82f6" style={{animation:'bar1 1.4s ease-in-out infinite'}}/>
    <rect x="8" width="4" height="14" y="10" rx="1.5" fill="#60a5fa" style={{animation:'bar2 1.4s ease-in-out infinite 0.2s'}}/>
    <rect x="14" width="4" height="10" y="14" rx="1.5" fill="#93c5fd" style={{animation:'bar3 1.4s ease-in-out infinite 0.4s'}}/>
    <rect x="20" width="4" height="18" y="6" rx="1.5" fill="#3b82f6" style={{animation:'bar4 1.4s ease-in-out infinite 0.1s'}}/>
    <line x1="1" y1="25" x2="27" y2="25" stroke="#3b82f6" strokeWidth="1.5" strokeOpacity="0.4"/>
  </svg>
);

export default function Sidebar() {
  const { t } = useTranslation();

  const navItems = [
    { to: '/', label: t('nav.dashboard'), Icon: IconDashboard, exact: true, accent: '#3b82f6' },
    { to: '/meta-ads', label: t('nav.metaAds'), Icon: IconMeta, exact: false, accent: '#1877F2' },
    { to: '/google-ads', label: t('nav.googleAds'), Icon: IconGoogle, exact: false, accent: '#4285F4' },
    { to: '/tiktok-ads', label: 'TikTok Ads', Icon: IconTikTok, exact: false, accent: '#ffffff' },
    { to: '/report-table', label: 'Maliyyə Cədvəli', Icon: IconTable, exact: false, accent: '#10b981' },
    { to: '/chat', label: t('nav.chat'), Icon: IconChat, exact: false, accent: '#a78bfa' },
  ];

  return (
    <div className="w-56 flex-shrink-0 flex flex-col" style={{
      background: 'linear-gradient(180deg, #0a0f1e 0%, #0f172a 60%, #0d1425 100%)',
      borderRight: '1px solid rgba(255,255,255,0.06)',
    }}>
      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
        .nav-item-hover:hover { background: rgba(255,255,255,0.07) !important; }
      `}</style>

      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <AnimatedLogo />
        <div>
          <div className="font-bold" style={{ color: '#f8fafc', fontSize: '13px', letterSpacing: '0.08em' }}>
            Ads <span style={{ color: '#3b82f6' }}>AUDIT</span>
          </div>
          <div className="text-xs" style={{ color: '#334155', fontSize: '10px', letterSpacing: '0.05em' }}>
            Analytics Panel
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {navItems.map(({ to, label, Icon, exact, accent }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className="nav-item-hover flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all duration-200"
            style={({ isActive }) => isActive
              ? { background: 'rgba(59,130,246,0.15)', color: '#f8fafc', borderLeft: `2px solid ${accent}`, paddingLeft: '10px' }
              : { color: '#64748b', borderLeft: '2px solid transparent', paddingLeft: '10px' }
            }
          >
            {({ isActive }) => (
              <>
                <span style={{ color: isActive ? accent : '#475569', transition: 'color 0.2s' }}>
                  <Icon />
                </span>
                <span className="font-medium">{label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{
                    background: accent,
                    boxShadow: `0 0 6px ${accent}`,
                    animation: 'pulse-dot 2s ease-in-out infinite',
                  }} />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 flex items-center gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ color: '#1e3a5f', fontSize: '10px' }}>v1.0</span>
        <span style={{ color: '#1e3a5f', fontSize: '10px' }}>·</span>
        <span style={{ color: '#1e3a5f', fontSize: '10px' }}>166 Ads Audit</span>
      </div>
    </div>
  );
}
