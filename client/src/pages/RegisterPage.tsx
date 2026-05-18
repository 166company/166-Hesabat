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
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Qeydiyyat tamamlandı</h2>
          <p className="text-sm text-gray-600 mb-6">{t('auth.pendingApproval')}</p>
          <p className="text-xs text-gray-500">{t('auth.approvalInfo')}</p>
          <Link to="/login" className="mt-6 inline-block text-sm text-blue-600 hover:underline">{t('auth.login')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="absolute top-4 right-4"><LanguageSelector /></div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-gray-800 mb-1">{t('app.title')}</div>
          <div className="text-sm text-gray-500">{t('app.subtitle')}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">{t('auth.register')}</h2>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1.5 font-medium">{t('auth.name')}</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1.5 font-medium">{t('auth.email')}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1.5 font-medium">{t('auth.password')}</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#4285F4' }}>
              {loading ? t('common.loading') : t('auth.registerBtn')}
            </button>
          </form>
          <p className="mt-4 text-xs text-center text-gray-500">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="text-blue-600 hover:underline font-medium">{t('auth.login')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
