import React, { useState } from 'react';
import { Shield, Eye, EyeOff, Lock, User, Phone, KeyRound, ArrowLeft, RefreshCw, CheckCircle, Send } from 'lucide-react';
import AcronymInfo from './AcronymInfo';

// ─── Screens ──────────────────────────────────────────────────────────────────
// 'signin' | 'signup' | 'forgot_phone' | 'forgot_otp' | 'forgot_newpass' | 'forgot_success'

export default function Auth({ onSignIn }) {
  const [screen, setScreen] = useState('signin');

  // Sign In / Sign Up shared state
  const [username, setUsername]           = useState('');
  const [phone, setPhone]                 = useState('');
  const [password, setPassword]           = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]   = useState(false);

  // Forgot Password state
  const [fpPhone, setFpPhone]             = useState('');
  const [fpOtp, setFpOtp]                 = useState('');
  const [fpVerifiedOtp, setFpVerifiedOtp] = useState('');  // keep OTP for reset step
  const [fpNewPass, setFpNewPass]         = useState('');
  const [fpConfirmPass, setFpConfirmPass] = useState('');
  const [fpShowPass, setFpShowPass]       = useState(false);
  const [fpDemoOtp, setFpDemoOtp]         = useState('');  // demo-only: show OTP in toast
  const [otpTimer, setOtpTimer]           = useState(0);  // countdown in seconds
  const [otpIntervalId, setOtpIntervalId] = useState(null);

  // Shared feedback
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [loading, setLoading]   = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const clearFeedback = () => { setError(''); setSuccess(''); };

  const goTo = (s) => { clearFeedback(); setScreen(s); };

  const startOtpCountdown = () => {
    setOtpTimer(60);
    if (otpIntervalId) clearInterval(otpIntervalId);
    const id = setInterval(() => {
      setOtpTimer(prev => {
        if (prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
    setOtpIntervalId(id);
  };

  // ── Sign In ───────────────────────────────────────────────────────────────
  const handleSignIn = async (e) => {
    e.preventDefault();
    clearFeedback();
    if (!username.trim() || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: username, password })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Authentication failed.'); setLoading(false); return; }
      onSignIn(data.username);
    } catch { setError('Could not reach authentication server.'); setLoading(false); }
  };

  // ── Sign Up ───────────────────────────────────────────────────────────────
  const handleSignUp = async (e) => {
    e.preventDefault();
    clearFeedback();
    if (!username.trim() || !phone.trim() || !password || !confirmPassword) { setError('Please fill in all fields.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 4) { setError('Password must be at least 4 characters.'); return; }
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, phone, password })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Registration failed.'); setLoading(false); return; }
      setSuccess('Registered! Logging in…');
      setTimeout(() => onSignIn(data.user.username), 1200);
    } catch { setError('Could not reach server.'); setLoading(false); }
  };

  // ── Forgot Step 1: Send OTP ───────────────────────────────────────────────
  const handleSendOtp = async (e) => {
    e.preventDefault();
    clearFeedback();
    if (!fpPhone.trim()) { setError('Please enter your registered phone number.'); return; }
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fpPhone })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not send OTP.'); setLoading(false); return; }
      setFpDemoOtp(data.demoOtp || '');   // demo only — show OTP in UI
      startOtpCountdown();
      setLoading(false);
      setSuccess(`OTP sent to ${fpPhone.slice(-4).padStart(fpPhone.length, '•')}`);
      goTo('forgot_otp');
    } catch { setError('Server unreachable.'); setLoading(false); }
  };

  // ── Forgot Step 2: Verify OTP ─────────────────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    clearFeedback();
    if (fpOtp.length !== 6) { setError('Enter the 6-digit OTP.'); return; }
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fpPhone, otp: fpOtp })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'OTP verification failed.'); setLoading(false); return; }
      setFpVerifiedOtp(fpOtp);
      setLoading(false);
      goTo('forgot_newpass');
    } catch { setError('Server unreachable.'); setLoading(false); }
  };

  // ── Forgot Step 3: Reset Password ─────────────────────────────────────────
  const handleResetPassword = async (e) => {
    e.preventDefault();
    clearFeedback();
    if (!fpNewPass || !fpConfirmPass) { setError('Please fill in both password fields.'); return; }
    if (fpNewPass !== fpConfirmPass) { setError('Passwords do not match.'); return; }
    if (fpNewPass.length < 4) { setError('Password must be at least 4 characters.'); return; }
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fpPhone, otp: fpVerifiedOtp, newPassword: fpNewPass })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Reset failed.'); setLoading(false); return; }
      setLoading(false);
      goTo('forgot_success');
    } catch { setError('Server unreachable.'); setLoading(false); }
  };

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const handleResendOtp = async () => {
    if (otpTimer > 0) return;
    clearFeedback();
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fpPhone })
      });
      const data = await res.json();
      if (res.ok) {
        setFpDemoOtp(data.demoOtp || '');
        startOtpCountdown();
        setSuccess('New OTP sent successfully.');
      } else {
        setError(data.error || 'Resend failed.');
      }
    } catch { setError('Server unreachable.'); }
    setLoading(false);
  };

  // ─── Shared Screen Wrapper ─────────────────────────────────────────────────
  return (
    <div style={S.page} className="animate-slideup">
      <div style={S.card} className="glass-container">

        {/* ── Header (always shown) ── */}
        <div style={S.header}>
          <div style={S.iconRing} className="secure-pulse">
            <Shield size={36} color="#06b6d4" />
          </div>
          <h1 style={S.title}>AANCHAL</h1>
          <p style={S.subtitle}>आँचल • AI Safety & Health Shield</p>
        </div>

        {/* ════ Sign In Screen ════ */}
        {screen === 'signin' && (
          <form onSubmit={handleSignIn} style={S.form}>
            {error   && <div style={S.errBox}>{error}</div>}
            {success && <div style={S.okBox}>{success}</div>}

            <Field label="Username or Phone" icon={<User size={17} />}>
              <input className="glass-input" type="text"
                placeholder="Enter username or phone"
                value={username} onChange={e => setUsername(e.target.value)}
                style={S.fieldInput} disabled={loading} />
            </Field>

            <Field label="Password" icon={<Lock size={17} />}>
              <input className="glass-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password} onChange={e => setPassword(e.target.value)}
                style={{ ...S.fieldInput, paddingRight: '45px' }} disabled={loading} />
              <EyeToggle show={showPassword} onToggle={() => setShowPassword(!showPassword)} />
            </Field>

            <div style={{ textAlign: 'right', marginTop: '-10px' }}>
              <button type="button" style={S.forgotLink}
                onClick={() => { clearFeedback(); setFpPhone(''); setFpOtp(''); setFpNewPass(''); setFpConfirmPass(''); setFpDemoOtp(''); goTo('forgot_phone'); }}>
                Forgot Password?
              </button>
            </div>

            <button type="submit" className="btn-neon-cyan"
              style={{ width: '100%', marginTop: '8px' }} disabled={loading}>
              {loading ? 'Authenticating…' : 'Secure Sign In'}
            </button>

            <SwitchLink text="New here?" action="Register Safety Account"
              onClick={() => goTo('signup')} disabled={loading} />
          </form>
        )}

        {/* ════ Sign Up Screen ════ */}
        {screen === 'signup' && (
          <form onSubmit={handleSignUp} style={S.form}>
            <BackBtn onClick={() => goTo('signin')} />
            {error   && <div style={S.errBox}>{error}</div>}
            {success && <div style={S.okBox}>{success}</div>}

            <Field label="Username" icon={<User size={17} />}>
              <input className="glass-input" type="text"
                placeholder="Choose a username"
                value={username} onChange={e => setUsername(e.target.value)}
                style={S.fieldInput} disabled={loading} />
            </Field>

            <Field label="Phone Number" icon={<Phone size={17} />}>
              <input className="glass-input" type="tel"
                placeholder="10-digit mobile number"
                value={phone} onChange={e => setPhone(e.target.value.replace(/\D/, '').slice(0, 10))}
                style={S.fieldInput} disabled={loading} />
            </Field>

            <Field label="Password" icon={<Lock size={17} />}>
              <input className="glass-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 4 characters"
                value={password} onChange={e => setPassword(e.target.value)}
                style={{ ...S.fieldInput, paddingRight: '45px' }} disabled={loading} />
              <EyeToggle show={showPassword} onToggle={() => setShowPassword(!showPassword)} />
            </Field>

            <Field label="Confirm Password" icon={<KeyRound size={17} />}>
              <input className="glass-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Repeat your password"
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                style={S.fieldInput} disabled={loading} />
            </Field>

            <button type="submit" className="btn-neon-cyan"
              style={{ width: '100%', marginTop: '8px' }} disabled={loading}>
              {loading ? 'Creating Account…' : 'Create Safety Account'}
            </button>

            <SwitchLink text="Already registered?" action="Sign In"
              onClick={() => goTo('signin')} disabled={loading} />
          </form>
        )}

        {/* ════ Forgot — Step 1: Enter Phone ════ */}
        {screen === 'forgot_phone' && (
          <form onSubmit={handleSendOtp} style={S.form}>
            <BackBtn onClick={() => goTo('signin')} />
            <StepHeader step={1} total={3} title="Forgot Password" sub="Enter your registered phone number to receive a 6-digit OTP." />

            {error   && <div style={S.errBox}>{error}</div>}
            {success && <div style={S.okBox}>{success}</div>}

            <Field label="Registered Phone Number" icon={<Phone size={17} />}>
              <input className="glass-input" type="tel"
                placeholder="10-digit phone number"
                value={fpPhone} onChange={e => setFpPhone(e.target.value.replace(/\D/, '').slice(0, 10))}
                style={S.fieldInput} disabled={loading} />
            </Field>

            <button type="submit" className="btn-neon-cyan"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              disabled={loading || fpPhone.length < 10}>
              <Send size={17} />
              {loading ? 'Sending OTP…' : 'Send OTP via SMS'}
            </button>
          </form>
        )}

        {/* ════ Forgot — Step 2: Verify OTP ════ */}
        {screen === 'forgot_otp' && (
          <form onSubmit={handleVerifyOtp} style={S.form}>
            <BackBtn onClick={() => goTo('forgot_phone')} />
            <StepHeader step={2} total={3} title="Enter OTP"
              sub={`A 6-digit code was sent to ••••${fpPhone.slice(-4)}.`} />

            {/* Demo OTP toast — only shown in local workspace */}
            {fpDemoOtp && (
              <div style={S.demoOtpBox}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>🧪 DEMO OTP (server console):</span>
                <span style={S.demoOtpCode}>{fpDemoOtp}</span>
              </div>
            )}

            {error   && <div style={S.errBox}>{error}</div>}
            {success && <div style={S.okBox}>{success}</div>}

            <Field label="6-Digit OTP" icon={<KeyRound size={17} />}>
              <input className="glass-input" type="text" inputMode="numeric"
                placeholder="● ● ● ● ● ●"
                maxLength={6}
                value={fpOtp} onChange={e => setFpOtp(e.target.value.replace(/\D/, '').slice(0, 6))}
                style={{ ...S.fieldInput, textAlign: 'center', letterSpacing: '10px', fontSize: '1.4rem', fontWeight: '700' }}
                disabled={loading} />
            </Field>

            {/* Resend & countdown */}
            <div style={S.resendRow}>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Didn't receive it?</span>
              <button type="button" style={{
                ...S.forgotLink,
                opacity: otpTimer > 0 ? 0.4 : 1,
                cursor: otpTimer > 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '5px'
              }} onClick={handleResendOtp} disabled={otpTimer > 0 || loading}>
                <RefreshCw size={13} />
                {otpTimer > 0 ? `Resend in ${otpTimer}s` : 'Resend OTP'}
              </button>
            </div>

            <button type="submit" className="btn-neon-purple"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              disabled={loading || fpOtp.length !== 6}>
              {loading ? 'Verifying…' : 'Verify OTP'}
            </button>
          </form>
        )}

        {/* ════ Forgot — Step 3: New Password ════ */}
        {screen === 'forgot_newpass' && (
          <form onSubmit={handleResetPassword} style={S.form}>
            <StepHeader step={3} total={3} title="Set New Password"
              sub="Choose a strong new password for your AANCHAL account." />

            {error && <div style={S.errBox}>{error}</div>}

            <Field label="New Password" icon={<Lock size={17} />}>
              <input className="glass-input"
                type={fpShowPass ? 'text' : 'password'}
                placeholder="Min. 4 characters"
                value={fpNewPass} onChange={e => setFpNewPass(e.target.value)}
                style={{ ...S.fieldInput, paddingRight: '45px' }} disabled={loading} />
              <EyeToggle show={fpShowPass} onToggle={() => setFpShowPass(!fpShowPass)} />
            </Field>

            <Field label="Confirm New Password" icon={<KeyRound size={17} />}>
              <input className="glass-input"
                type={fpShowPass ? 'text' : 'password'}
                placeholder="Repeat new password"
                value={fpConfirmPass} onChange={e => setFpConfirmPass(e.target.value)}
                style={S.fieldInput} disabled={loading} />
            </Field>

            {/* Password strength mini-bar */}
            <StrengthBar password={fpNewPass} />

            <button type="submit" className="btn-neon-cyan"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              disabled={loading}>
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>
          </form>
        )}

        {/* ════ Forgot — Step 4: Success ════ */}
        {screen === 'forgot_success' && (
          <div style={{ ...S.form, alignItems: 'center', textAlign: 'center' }}>
            <div style={S.successCircle} className="secure-pulse">
              <CheckCircle size={48} color="#22c55e" />
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: '700', color: '#22c55e', marginBottom: '8px' }}>
              Password Reset!
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: '280px', lineHeight: '1.5', marginBottom: '28px' }}>
              Your AANCHAL account password has been updated successfully. You can now sign in with your new password.
            </p>
            <button className="btn-neon-cyan" style={{ width: '100%' }}
              onClick={() => { clearFeedback(); setFpPhone(''); setFpOtp(''); setFpVerifiedOtp(''); setFpNewPass(''); setFpConfirmPass(''); setFpDemoOtp(''); setPassword(''); goTo('signin'); }}>
              Back to Sign In
            </button>
          </div>
        )}

        {/* Acronym Info panel — shown on sign-in + forgot screens */}
        {(screen === 'signin' || screen === 'forgot_phone') && (
          <AcronymInfo compact={true} />
        )}

        <footer style={S.footer}>
          <span style={S.footerTxt}>Offline Emergency Core Active</span>
          <span style={S.footerDot} className="secure-pulse" />
        </footer>
      </div>
    </div>
  );
}

// ─── Sub-Components ────────────────────────────────────────────────────────────
function Field({ label, icon, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
      <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8', paddingLeft: '4px' }}>{label}</label>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <span style={{ position: 'absolute', left: '15px', color: '#64748b', pointerEvents: 'none' }}>{icon}</span>
        {children}
      </div>
    </div>
  );
}

function EyeToggle({ show, onToggle }) {
  return (
    <button type="button" onClick={onToggle}
      style={{ position: 'absolute', right: '14px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
      {show ? <EyeOff size={17} color="#94a3b8" /> : <Eye size={17} color="#94a3b8" />}
    </button>
  );
}

function BackBtn({ onClick }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none',
        color: '#64748b', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
      <ArrowLeft size={15} /> Back
    </button>
  );
}

function SwitchLink({ text, action, onClick, disabled }) {
  return (
    <div style={{ textAlign: 'center', marginTop: '8px' }}>
      <span style={{ fontSize: '0.82rem', color: '#64748b' }}>{text} </span>
      <button type="button" onClick={onClick} disabled={disabled}
        style={{ background: 'none', border: 'none', color: '#06b6d4', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
        {action}
      </button>
    </div>
  );
}

function StepHeader({ step, total, title, sub }) {
  return (
    <div style={{ marginBottom: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        {[...Array(total)].map((_, i) => (
          <div key={i} style={{
            height: '4px', flex: 1, borderRadius: '2px',
            backgroundColor: i < step ? '#06b6d4' : 'rgba(255,255,255,0.1)',
            transition: 'background-color 0.4s ease',
          }} />
        ))}
      </div>
      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>{title}</h3>
      {sub && <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5 }}>{sub}</p>}
    </div>
  );
}

function StrengthBar({ password }) {
  const len = password.length;
  const hasUpper = /[A-Z]/.test(password);
  const hasNum   = /[0-9]/.test(password);
  const hasSpec  = /[^a-zA-Z0-9]/.test(password);
  const score = (len >= 8 ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNum ? 1 : 0) + (hasSpec ? 1 : 0);
  const colors = ['#f43f5e','#f97316','#eab308','#22c55e'];
  const labels = ['Weak','Fair','Good','Strong'];
  if (!password) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '-4px' }}>
      {[0,1,2,3].map(i => (
        <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px',
          backgroundColor: i < score ? colors[score-1] : 'rgba(255,255,255,0.08)',
          transition: 'background-color 0.3s ease' }} />
      ))}
      <span style={{ fontSize: '0.72rem', color: colors[score-1] || '#64748b', minWidth: '40px', fontWeight: 700 }}>
        {labels[score-1] || ''}
      </span>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    minHeight: '100vh', padding: '20px',
  },
  card: {
    width: '100%', maxWidth: '430px', padding: '36px 28px',
    display: 'flex', flexDirection: 'column',
  },
  header: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px' },
  iconRing: {
    width: '68px', height: '68px', borderRadius: '50%',
    background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px',
  },
  title: {
    fontSize: '2.4rem', fontWeight: 800, letterSpacing: '2px',
    background: 'linear-gradient(135deg, #f8fafc 40%, #94a3b8 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
  },
  subtitle: { color: '#06b6d4', fontSize: '0.85rem', fontWeight: 600, marginTop: '3px', letterSpacing: '1px', textTransform: 'uppercase' },
  form: { display: 'flex', flexDirection: 'column', gap: '18px' },
  fieldInput: { paddingLeft: '42px' },
  errBox: {
    color: '#f43f5e', background: 'rgba(244,63,94,0.1)',
    border: '1px solid rgba(244,63,94,0.2)', padding: '11px 14px',
    borderRadius: '10px', fontSize: '0.83rem', lineHeight: 1.4,
  },
  okBox: {
    color: '#22c55e', background: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.2)', padding: '11px 14px',
    borderRadius: '10px', fontSize: '0.83rem',
  },
  forgotLink: {
    background: 'none', border: 'none', color: '#06b6d4',
    fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
  },
  demoOtpBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
    padding: '12px', borderRadius: '12px',
    background: 'rgba(168,85,247,0.08)', border: '1px dashed rgba(168,85,247,0.35)',
  },
  demoOtpCode: {
    fontSize: '2rem', fontWeight: 800, letterSpacing: '10px',
    color: '#a855f7', fontFamily: 'monospace',
    textShadow: '0 0 12px rgba(168,85,247,0.5)',
  },
  resendRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginTop: '-6px',
  },
  successCircle: {
    width: '90px', height: '90px', borderRadius: '50%',
    background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px',
  },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '24px' },
  footerTxt: { color: '#64748b', fontSize: '0.72rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' },
  footerDot: { width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#06b6d4' },
};
