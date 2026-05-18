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
const IconChat = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
);

export default function Sidebar() {
  const { t } = useTranslation();

  const navItems = [
    { to: '/', label: t('nav.dashboard'), Icon: IconDashboard, exact: true },
    { to: '/meta-ads', label: t('nav.metaAds'), Icon: IconMeta, exact: false },
    { to: '/google-ads', label: t('nav.googleAds'), Icon: IconGoogle, exact: false },
    { to: '/report-table', label: 'Maliyyə Cədvəli', Icon: IconTable, exact: false },
    { to: '/chat', label: t('nav.chat'), Icon: IconChat, exact: false },
  ];

  return (
    <div className="w-56 flex-shrink-0 flex flex-col" style={{ background: '#0f172a' }}>
      {/* Logo */}
      <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="text-sm font-bold tracking-widest uppercase" style={{ color: '#f8fafc', letterSpacing: '0.12em' }}>
          Ads Audit
        </div>
        <div className="text-xs mt-1" style={{ color: '#64748b' }}>
          Analytics Panel
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {navItems.map(({ to, label, Icon, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-all duration-150 ${
                isActive
                  ? 'font-semibold'
                  : 'font-normal'
              }`
            }
            style={({ isActive }) => isActive
              ? { background: 'rgba(255,255,255,0.1)', color: '#f8fafc' }
              : { color: '#94a3b8' }
            }
          >
            {({ isActive }) => (
              <>
                <span style={{ color: isActive ? '#f8fafc' : '#475569' }}>
                  <Icon />
                </span>
                <span>{label}</span>
                {isActive && (
                  <span className="ml-auto w-1 h-4 rounded-full" style={{ background: '#3b82f6' }} />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', color: '#334155', fontSize: '11px' }}>
        v1.0
      </div>
    </div>
  );
}
