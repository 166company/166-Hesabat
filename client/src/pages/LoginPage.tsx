import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LanguageSelector from '../components/common/LanguageSelector';

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || t('errors.general'));
    } finally {
      setLoading(false);
    }
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
          <h2 className="text-lg font-semibold text-gray-800 mb-6">{t('auth.login')}</h2>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1.5 font-medium">{t('auth.email')}</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1.5 font-medium">{t('auth.password')}</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full py-2.5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#4285F4' }}
            >
              {loading ? t('common.loading') : t('auth.loginBtn')}
            </button>
          </form>
          <p className="mt-4 text-xs text-center text-gray-500">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-blue-600 hover:underline font-medium">{t('auth.register')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
