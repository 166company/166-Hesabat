import { useState, FormEvent, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, OtpChallenge, ApprovalChallenge } from '../context/AuthContext';
import LanguageSelector from '../components/common/LanguageSelector';

const BgAnim = () => (
  <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.07 }} viewBox="0 0 400 400" fill="none">
    <style>{`
      @keyframes bg1 { 0%,100%{cx:100;cy:120} 50%{cx:140;cy:80} }
      @keyframes bg2 { 0%,100%{cx:300;cy:280} 50%{cx:260;cy:320} }
      @keyframes bg3 { 0%,100%{cx:320;cy:80} 50%{cx:280;cy:120} }
    `}</style>
    <circle r="120" fill="#3b82f6" cx="100" cy="120" style={{animation:'bg1 8s ease-in-out infinite'}}/>
    <circle r="100" fill="#60a5fa" cx="300" cy="280" style={{animation:'bg2 10s ease-in-out infinite'}}/>
    <circle r="80" fill="#1d4ed8" cx="320" cy="80" style={{animation:'bg3 7s ease-in-out infinite'}}/>
  </svg>
);

const LogoAnim = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
    <style>{`
      @keyframes lb1{0%,100%{height:10;y:22}50%{height:18;y:14}}
      @keyframes lb2{0%,100%{height:18;y:14}50%{height:26;y:6}}
      @keyframes lb3{0%,100%{height:14;y:18}50%{height:10;y:22}}
      @keyframes lb4{0%,100%{height:24;y:8}50%{height:16;y:16}}
    `}</style>
    <rect x="2" width="6" rx="2" fill="#60a5fa" height="10" y="22" style={{animation:'lb1 1.8s ease-in-out infinite'}}/>
    <rect x="10" width="6" rx="2" fill="#3b82f6" height="18" y="14" style={{animation:'lb2 1.8s ease-in-out infinite 0.2s'}}/>
    <rect x="18" width="6" rx="2" fill="#93c5fd" height="14" y="18" style={{animation:'lb3 1.8s ease-in-out infinite 0.4s'}}/>
    <rect x="26" width="6" rx="2" fill="#3b82f6" height="24" y="8" style={{animation:'lb4 1.8s ease-in-out infinite 0.1s'}}/>
    <line x1="0" y1="35" x2="40" y2="35" stroke="#3b82f6" strokeWidth="1.5" opacity="0.5"/>
  </svg>
);

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  function handleChange(i: number, v: string) {
    const digit = v.replace(/\D/g, '').slice(-1);
    const arr = value.split('');
    arr[i] = digit;
    const next = arr.join('').padEnd(6, '').slice(0, 6);
    onChange(next);
    if (digit && i < 5) inputs.current[i + 1]?.focus();
  }
  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace') {
      const arr = value.split('');
      if (!arr[i] && i > 0) { arr[i - 1] = ''; onChange(arr.join('')); inputs.current[i - 1]?.focus(); }
      else { arr[i] = ''; onChange(arr.join('')); }
    }
    if (e.key === 'ArrowLeft' && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) inputs.current[i + 1]?.focus();
  }
  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) { onChange(pasted.padEnd(6, '').slice(0, 6)); inputs.current[Math.min(pasted.length, 5)]?.focus(); }
    e.preventDefault();
  }
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
      {Array.from({ length: 6 }, (_, i) => (
        <input key={i} ref={el => { inputs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1}
          value={value[i] || ''}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          style={{
            width: 44, height: 54, textAlign: 'center', fontSize: 22, fontWeight: 700,
            background: value[i] ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)',
            border: `2px solid ${value[i] ? '#3b82f6' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: 10, color: '#f8fafc', outline: 'none', transition: 'border-color 0.15s',
          }}
          onFocus={e => { e.target.style.borderColor = '#60a5fa'; }}
          onBlur={e => { e.target.style.borderColor = value[i] ? '#3b82f6' : 'rgba(255,255,255,0.12)'; }}
        />
      ))}
    </div>
  );
}

function useCountdown(active: boolean, seconds: number) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    if (!active) return;
    setRemaining(seconds);
    const t = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [active, seconds]);
  const m = Math.floor(remaining / 60).toString().padStart(2, '0');
  const s = (remaining % 60).toString().padStart(2, '0');
  return { remaining, display: `${m}:${s}` };
}

// Dövrə animasiyası (approval gözlənilir)
function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: '3px solid rgba(59,130,246,0.2)',
        borderTop: '3px solid #3b82f6',
        animation: 'spin 1s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

type Step = 'login' | 'otp' | 'approval';

export default function LoginPage() {
  const { t } = useTranslation();
  const { login, verifyOtp, checkApprovalStatus } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [otpChallenge, setOtpChallenge] = useState<OtpChallenge | null>(null);
  const [approvalChallenge, setApprovalChallenge] = useState<ApprovalChallenge | null>(null);

  const otpCountdown = useCountdown(step === 'otp', 300);
  const approvalCountdown = useCountdown(step === 'approval', 600);

  // Admin approval polling — hər 3 saniyədə bir yoxla
  useEffect(() => {
    if (step !== 'approval' || !approvalChallenge) return;
    const interval = setInterval(async () => {
      try {
        const status = await checkApprovalStatus(approvalChallenge.approvalSessionToken);
        if (status === 'approved') {
          clearInterval(interval);
          navigate('/');
        } else if (status === 'denied') {
          clearInterval(interval);
          setError('Girişiniz admin tərəfindən rədd edildi.');
          setStep('login');
          setApprovalChallenge(null);
        } else if (status === 'expired') {
          clearInterval(interval);
          setError('Təsdiq müddəti bitdi. Yenidən cəhd edin.');
          setStep('login');
          setApprovalChallenge(null);
        }
      } catch { /* network error, retry */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [step, approvalChallenge, checkApprovalStatus, navigate]);

  async function handleLoginSubmit(e: FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const result = await login(email, password);
      if (result?.requiresOtp) { setOtpChallenge(result); setOtp(''); setStep('otp'); }
    } catch (err: any) {
      setError(err.response?.data?.error || t('errors.general'));
    } finally { setLoading(false); }
  }

  async function handleOtpSubmit(e: FormEvent) {
    e.preventDefault();
    if (otp.length < 6) { setError('6 rəqəmli kodu tam daxil edin.'); return; }
    setError(''); setLoading(true);
    try {
      const result = await verifyOtp(otpChallenge!.sessionToken, otp);
      if (result?.requiresApproval) { setApprovalChallenge(result); setStep('approval'); }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Kod yanlışdır.');
      setOtp('');
    } finally { setLoading(false); }
  }

  function handleBack() {
    setStep('login'); setOtpChallenge(null); setApprovalChallenge(null); setOtp(''); setError('');
  }

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 20, padding: 36, backdropFilter: 'blur(20px)',
    animation: 'fadeUp 0.4s ease-out both',
  };

  const btnPrimary = (disabled: boolean): React.CSSProperties => ({
    padding: '12px', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer', transition: 'opacity 0.2s', color: '#fff',
    background: disabled ? 'rgba(59,130,246,0.3)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    boxShadow: '0 4px 16px rgba(59,130,246,0.3)',
  });

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #0f172a 60%, #0d1425 100%)' }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .auth-input { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #f8fafc; border-radius: 10px; padding: 10px 14px; font-size: 14px; width: 100%; outline: none; transition: border-color 0.2s; }
        .auth-input::placeholder { color: #475569; }
        .auth-input:focus { border-color: #3b82f6; background: rgba(59,130,246,0.08); }
        .auth-label { color: #94a3b8; font-size: 12px; font-weight: 500; margin-bottom: 6px; display: block; }
      `}</style>
      <BgAnim />

      {/* Sol panel */}
      <div className="hidden lg:flex flex-col justify-center px-16 flex-1" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ animation: 'fadeUp 0.6s ease-out' }}>
          <div className="flex items-center gap-3 mb-8">
            <LogoAnim />
            <span style={{ color: '#f8fafc', fontSize: '20px', fontWeight: 700, letterSpacing: '0.05em' }}>
              Ads <span style={{ color: '#3b82f6' }}>AUDIT</span>
            </span>
          </div>
          <h1 style={{ color: '#f8fafc', fontSize: '32px', fontWeight: 800, lineHeight: 1.2, marginBottom: 16 }}>
            Reklam analitikanızı<br /><span style={{ color: '#60a5fa' }}>bir yerdə idarə edin</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.7, maxWidth: 360 }}>
            Meta, Google və TikTok Ads hesablarınızı birləşdirin. Kampaniya xərclərini real vaxtda izləyin.
          </p>
          <div className="flex gap-6 mt-10">
            {[['Meta', '#1877F2'], ['Google', '#4285F4'], ['TikTok', '#fff']].map(([name, color]) => (
              <div key={name} className="flex items-center gap-2">
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
                <span style={{ color: '#475569', fontSize: '12px' }}>{name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sağ panel */}
      <div className="flex items-center justify-center flex-1 px-6 py-12" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div className="absolute top-4 right-4"><LanguageSelector /></div>

          {/* ── ADDIM 1: Login ── */}
          {step === 'login' && (
            <div style={cardStyle}>
              <div className="flex items-center gap-3 mb-6 lg:hidden"><LogoAnim /><span style={{ color: '#f8fafc', fontSize: '16px', fontWeight: 700 }}>Ads <span style={{ color: '#3b82f6' }}>AUDIT</span></span></div>
              <h2 style={{ color: '#f8fafc', fontSize: '20px', fontWeight: 700, marginBottom: 4 }}>{t('auth.login')}</h2>
              <p style={{ color: '#64748b', fontSize: '13px', marginBottom: 24 }}>Hesabınıza daxil olun</p>
              {error && <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 10, color: '#fca5a5', fontSize: 12 }}>{error}</div>}
              <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div><label className="auth-label">{t('auth.email')}</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="auth-input" placeholder="email@example.com" /></div>
                <div><label className="auth-label">{t('auth.password')}</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="auth-input" placeholder="••••••••" /></div>
                <button type="submit" disabled={loading} style={{ marginTop: 8, ...btnPrimary(loading) }}>
                  {loading ? t('common.loading') : t('auth.loginBtn')}
                </button>
              </form>
              <p style={{ marginTop: 20, fontSize: 13, textAlign: 'center', color: '#475569' }}>
                {t('auth.noAccount')}{' '}<Link to="/register" style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}>{t('auth.register')}</Link>
              </p>
            </div>
          )}

          {/* ── ADDIM 2: OTP ── */}
          {step === 'otp' && otpChallenge && (
            <div style={cardStyle}>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', border: '2px solid rgba(59,130,246,0.3)', fontSize: 28, marginBottom: 12 }}>🔐</div>
                <h2 style={{ color: '#f8fafc', fontSize: '18px', fontWeight: 700, marginBottom: 6 }}>Email Doğrulaması</h2>
                <p style={{ color: '#64748b', fontSize: '12px', lineHeight: 1.6 }}>
                  <span style={{ color: '#93c5fd' }}>{otpChallenge.email}</span><br />ünvanına 6 rəqəmli kod göndərildi
                </p>
              </div>
              {error && <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 10, color: '#fca5a5', fontSize: 12, textAlign: 'center' }}>{error}</div>}
              <form onSubmit={handleOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <OtpInput value={otp} onChange={setOtp} />
                <div style={{ textAlign: 'center' }}>
                  {otpCountdown.remaining > 0
                    ? <span style={{ color: otpCountdown.remaining < 60 ? '#f87171' : '#64748b', fontSize: 13 }}>Kodun etibarlılığı: <strong style={{ color: otpCountdown.remaining < 60 ? '#f87171' : '#93c5fd' }}>{otpCountdown.display}</strong></span>
                    : <span style={{ color: '#ef4444', fontSize: 13 }}>Kodun müddəti bitdi.</span>}
                </div>
                <button type="submit" disabled={loading || otp.length < 6 || otpCountdown.remaining === 0} style={btnPrimary(loading || otp.length < 6 || otpCountdown.remaining === 0)}>
                  {loading ? 'Yoxlanılır...' : 'Təsdiq et'}
                </button>
              </form>
              <button onClick={handleBack} style={{ marginTop: 12, width: '100%', padding: '10px', background: 'transparent', color: '#475569', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>
                ← Geri qayıt
              </button>
            </div>
          )}

          {/* ── ADDIM 3: Admin Təsdiqi Gözlənilir ── */}
          {step === 'approval' && (
            <div style={cardStyle}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%', background: 'rgba(234,179,8,0.12)', border: '2px solid rgba(234,179,8,0.3)', fontSize: 28, marginBottom: 12 }}>⏳</div>
                <h2 style={{ color: '#f8fafc', fontSize: '18px', fontWeight: 700, marginBottom: 8 }}>Admin Təsdiqi</h2>
                <p style={{ color: '#64748b', fontSize: '12px', lineHeight: 1.7 }}>
                  Girişiniz üçün admin emailinə<br />
                  <strong style={{ color: '#fbbf24' }}>Təsdiqlə / Rədd et</strong> sorğusu göndərildi.<br />
                  Admin təsdiq edəndə avtomatik daxil olacaqsınız.
                </p>
              </div>

              {error && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 10, color: '#fca5a5', fontSize: 12, textAlign: 'center' }}>
                  {error}
                </div>
              )}

              <Spinner />

              <div style={{ textAlign: 'center', marginTop: 16 }}>
                {approvalCountdown.remaining > 0
                  ? <span style={{ color: approvalCountdown.remaining < 120 ? '#f87171' : '#64748b', fontSize: 12 }}>
                      Sorğunun etibarlılığı: <strong style={{ color: approvalCountdown.remaining < 120 ? '#f87171' : '#94a3b8' }}>{approvalCountdown.display}</strong>
                    </span>
                  : <span style={{ color: '#ef4444', fontSize: 12 }}>Sorğunun müddəti bitdi.</span>}
              </div>

              <button onClick={handleBack} style={{ marginTop: 20, width: '100%', padding: '10px', background: 'transparent', color: '#475569', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>
                ← Ləğv et
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
