import React, { useState } from 'react';
import BrandPanel from '../components/BrandPanel.jsx';
import '../styles/recovery.css';

export default function SignIn({ onCreateAccount, initialEmail = '', onSignIn }) {
  const [values, setValues] = useState({ email: initialEmail, password: '' });
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showAdminHelp, setShowAdminHelp] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setValues(current => ({ ...current, [name]: value }));
    setErrors(current => ({ ...current, [name]: undefined }));
    setAuthError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    const trimmedEmail = values.email.trim();
    if (!/^[^\s@]+@[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = 'Masukkan alamat email kerja yang valid.';
    }
    if (!values.password) {
      nextErrors.password = 'Masukkan password akun Anda.';
    }
    setErrors(nextErrors);
    setAuthError('');

    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      document.getElementById(`signin-${firstInvalid}`)?.focus();
      return;
    }

    setLoading(true);
    try {
      if (onSignIn) {
        const effectiveEmail = trimmedEmail.endsWith('@test') ? `${trimmedEmail}.com` : trimmedEmail;
        const result = await onSignIn({ email: effectiveEmail, password: values.password });
        if (result && result.success === false) {
          setAuthError(result.message || 'Email atau password salah');
        }
      }
    } catch (err) {
      setAuthError(err.message || 'Terjadi kesalahan saat menghubungi server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="signup-layout">
      <BrandPanel />
      <section className={`form-panel signin-panel${authError ? ' signin-failed' : ''}`} aria-labelledby="signin-title">
        <div className="signup-content">
          <header className="signup-header">
            <p className="form-eyebrow">PORTAL MANAGER</p>
            <h2 id="signin-title">Sign in to SUSUNO</h2>
            <p className="form-description">Gunakan akun Manager Anda untuk mengakses dashboard gudang.</p>
          </header>

          {authError && (
            <div className="recovery-error signin-error" role="alert" style={{ marginBottom: '1.25rem' }}>
              <strong>Gagal Masuk</strong>
              <p>{authError}</p>
            </div>
          )}

          <form className="signin-form" noValidate onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="signin-email">Email Kerja</label>
              <input
                id="signin-email"
                name="email"
                type="email"
                required
                placeholder="nama@perusahaan.com"
                autoComplete="username"
                autoCapitalize="none"
                value={values.email}
                onChange={handleChange}
                disabled={loading}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'signin-email-error' : undefined}
              />
              {errors.email && <p className="field-error" id="signin-email-error">{errors.email}</p>}
            </div>

            <div className="form-field signin-password-field">
              <label htmlFor="signin-password">Password</label>
              <div className="password-input-wrap">
                <input
                  id="signin-password"
                  name="password"
                  type={visible ? 'text' : 'password'}
                  required
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                  value={values.password}
                  onChange={handleChange}
                  disabled={loading}
                  aria-invalid={Boolean(errors.password || authError)}
                  aria-describedby={errors.password ? 'signin-password-error' : undefined}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={visible ? 'Sembunyikan password' : 'Tampilkan password'}
                  aria-controls="signin-password"
                  onClick={() => setVisible(current => !current)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                    {!visible && <path d="M3 3 21 21" />}
                  </svg>
                </button>
              </div>
              {errors.password && <p className="field-error" id="signin-password-error">{errors.password}</p>}
            </div>

            <div className="forgot-password-row">
              <button
                type="button"
                className="text-button"
                style={{ fontSize: '0.85rem', color: '#666' }}
                onClick={() => setShowAdminHelp(true)}
              >
                Lupa password? (Hubungi admin)
              </button>
            </div>

            <button type="submit" className="continue-button signin-button" disabled={loading}>
              {loading ? 'Memverifikasi...' : authError ? 'Coba Lagi' : 'Masuk ke Dashboard'}
            </button>
          </form>

          {showAdminHelp && (
            <div
              role="dialog"
              aria-modal="true"
              style={{
                marginTop: '1rem',
                padding: '1rem',
                borderRadius: '8px',
                backgroundColor: '#f6f8f5',
                border: '1px solid #d3ded0',
                color: '#2d3725',
                fontSize: '0.9rem',
                lineHeight: '1.4',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  ℹ️ Lupa Password Akun Manager
                </strong>
                <button
                  type="button"
                  onClick={() => setShowAdminHelp(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#888' }}
                  aria-label="Tutup"
                >
                  ✕
                </button>
              </div>
              <p style={{ margin: '0 0 0.5rem' }}>
                Akun Manager tidak dapat melakukan reset password secara mandiri melalui web. Silakan hubungi <strong>Administrator IT Gudang</strong> atau departemen terkait untuk bantuan reset kredensial.
              </p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#555' }}>
                *Alur reset mandiri tanpa OTP hanya berlaku untuk akun <strong>Staf</strong> di aplikasi mobile.
              </p>
            </div>
          )}

          <div className="signin-register" style={{ marginTop: '1.5rem' }}>
            <p>Belum punya akun Manager?</p>
            <button type="button" className="back-button create-account-button" onClick={onCreateAccount}>
              Setup Workspace Baru
            </button>
          </div>

          <p className="signin-legal" style={{ marginTop: '1.25rem' }}>
            SUSUNO Warehouse Management System · Token aktif selama 8 jam.
          </p>
        </div>
      </section>
    </main>
  );
}
