import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import LanguageSelector from '../components/common/LanguageSelector';

export default function RegisterPage() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await api.post('/auth/register', { name, email, password });
      setSuccess(true);
    } catch (err: any) {
      const errs = err.response?.data?.errors;
      if (errs?.length) setError(errs.map((x: any) => x.msg).join(', '));
      else setError(err.response?.data?.error || t('errors.general'));
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #0f172a 60%, #0d1425 100%)' }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .auth-input2 { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #f8fafc; border-radius: 10px; padding: 10px 14px; font-size: 14px; width: 100%; outline: none; transition: border-color 0.2s; }
        .auth-input2::placeholder { color: #475569; }
        .auth-input2:focus { border-color: #3b82f6; background: rgba(59,130,246,0.08); }
      `}</style>
      <div className="absolute top-4 right-4" style={{ zIndex: 10 }}><LanguageSelector /></div>

      <div style={{ width: '100%', maxWidth: 400, animation: 'fadeUp 0.6s ease-out' }}>
        {success ? (
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20,
            padding: 40,
            backdropFilter: 'blur(20px)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ color: '#f8fafc', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Qeydiyyat tamamlandı</h2>
            <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>{t('auth.pendingApproval')}</p>
            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 24 }}>{t('auth.approvalInfo')}</p>
            <Link to="/login" style={{ color: '#60a5fa', fontSize: 14, fontWeight: 600 }}>{t('auth.login')} →</Link>
          </div>
        ) : (
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20,
            padding: 36,
            backdropFilter: 'blur(20px)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ color: '#f8fafc', fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
                Ads <span style={{ color: '#3b82f6' }}>AUDIT</span>
              </div>
              <p style={{ color: '#64748b', fontSize: 13 }}>Yeni hesab yaradın</p>
            </div>

            {error && (
              <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 10, color: '#fca5a5', fontSize: 12 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: t('auth.name'), type: 'text', val: name, set: setName, ph: 'Ad Soyad' },
                { label: t('auth.email'), type: 'email', val: email, set: setEmail, ph: 'email@example.com' },
                { label: t('auth.password'), type: 'password', val: password, set: setPassword, ph: '••••••••' },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 500, marginBottom: 6, display: 'block' }}>{f.label}</label>
                  <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)} required
                    className="auth-input2" placeholder={f.ph} minLength={f.type === 'password' ? 8 : undefined} />
                </div>
              ))}
              <button type="submit" disabled={loading} style={{
                marginTop: 8,
                padding: '12px',
                background: loading ? 'rgba(59,130,246,0.5)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 16px rgba(59,130,246,0.3)',
              }}>
                {loading ? t('common.loading') : t('auth.registerBtn')}
              </button>
            </form>

            <p style={{ marginTop: 20, fontSize: 13, textAlign: 'center', color: '#475569' }}>
              {t('auth.hasAccount')}{' '}
              <Link to="/login" style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}>{t('auth.login')}</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
