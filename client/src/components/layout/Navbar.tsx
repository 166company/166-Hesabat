import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';
import LanguageSelector from '../common/LanguageSelector';

const PAGE_META: Record<string, { title: string; accent: string }> = {
  '/':             { title: 'Dashboard',        accent: '#3b82f6' },
  '/meta-ads':     { title: 'Meta Ads',         accent: '#1877F2' },
  '/google-ads':   { title: 'Google Ads',       accent: '#4285F4' },
  '/tiktok-ads':   { title: 'TikTok Ads',       accent: '#000000' },
  '/report-table': { title: 'Maliyyə Cədvəli',  accent: '#16a34a' },
  '/chat':         { title: 'Qeydlər',          accent: '#7c3aed' },
};

export default function Navbar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  const meta = Object.entries(PAGE_META).reduce((best, [path, m]) => {
    if (pathname === path || (path !== '/' && pathname.startsWith(path))) return m;
    return best;
  }, PAGE_META['/']);

  return (
    <header className="h-14 flex items-center justify-between px-6" style={{
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid #e2e8f0',
      boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
    }}>
      <div className="flex items-center gap-3">
        <div className="w-1 h-5 rounded-full" style={{
          background: meta.accent,
          boxShadow: `0 0 8px ${meta.accent}60`,
        }} />
        <h1 className="text-sm font-semibold" style={{ color: '#0f172a' }}>{meta.title}</h1>
      </div>
      <div className="flex items-center gap-4">
        <LanguageSelector />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{
                background: `linear-gradient(135deg, ${meta.accent}, ${meta.accent}99)`,
                boxShadow: `0 2px 8px ${meta.accent}40`,
              }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-medium" style={{ color: '#334155' }}>{user?.name}</span>
          </div>
          <button
            onClick={logout}
            className="text-xs px-3 py-1.5 rounded-lg transition-all duration-200"
            style={{ color: '#64748b', border: '1px solid #e2e8f0' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = '#f8fafc';
              (e.currentTarget as HTMLElement).style.borderColor = '#cbd5e1';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0';
            }}
          >
            {t('nav.logout')}
          </button>
        </div>
      </div>
    </header>
  );
}
