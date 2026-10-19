import React, { useState } from 'react';
import BrandPanel from '../components/BrandPanel.jsx';
import '../styles/recovery.css';

export default function SignIn({ onCreateAccount, initialEmail = '', onSignIn, onForgotPassword }) {
  const [values, setValues] = useState({ email: initialEmail, password: '' });
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [authFailed, setAuthFailed] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setValues(current => ({ ...current, [name]: value }));
    setErrors(current => ({ ...current, [name]: undefined }));
    setNotice('');
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      nextErrors.email = 'Enter a valid work email address.';
    }
    if (!values.password) nextErrors.password = 'Enter your password.';
    setErrors(nextErrors);
    setNotice('');
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      document.getElementById(`signin-${firstInvalid}`)?.focus();
      return;
    }
    // Connect the login API here. Credentials must be verified by the server.
    if (onSignIn) {
      const accepted = onSignIn({ email: values.email.trim(), password: values.password });
      if (accepted === false) setAuthFailed(true);
    }
    else setAuthFailed(true); // Demo: simulate rejected login for the supplied error screen.
  }

  return (
    <main className="signup-layout">
      <BrandPanel />
      <section className={`form-panel signin-panel${authFailed ? ' signin-failed' : ''}`} aria-labelledby="signin-title">
        <div className="signup-content">
          <header className="signup-header">
            <p className="form-eyebrow">WELCOME BACK</p>
            <h2 id="signin-title">Sign in to SUSUNO</h2>
            <p className="form-description">Use your manager account to access the warehouse dashboard.</p>
          </header>
          {authFailed && <div className="recovery-error signin-error" role="alert">
            <strong>Unable to sign in</strong>
            <p>The email or password is incorrect. Please try again.</p>
          </div>}
          <form className="signin-form" noValidate onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="signin-email">Work email</label>
              <input id="signin-email" name="email" type="email" required
                placeholder="Enter your work email" autoComplete="username" autoCapitalize="none"
                value={values.email} onChange={handleChange}
                aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'signin-email-error' : undefined} />
              {errors.email && <p className="field-error" id="signin-email-error">{errors.email}</p>}
            </div>
            <div className="form-field signin-password-field">
              <label htmlFor="signin-password">Password</label>
              <div className="password-input-wrap">
                <input id="signin-password" name="password" type={visible ? 'text' : 'password'} required
                  placeholder="Enter your password" autoComplete="current-password"
                  value={values.password} onChange={handleChange}
                  aria-invalid={Boolean(errors.password || authFailed)} aria-describedby={errors.password ? 'signin-password-error' : undefined} />
                <button type="button" className="password-toggle" aria-label={visible ? 'Hide password' : 'Show password'}
                  aria-controls="signin-password" onClick={() => setVisible(current => !current)}>
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
              <button type="button" className="text-button" onClick={() => {
                if (onForgotPassword) onForgotPassword(values.email.trim());
                else setNotice('The password recovery page is not connected yet.');
              }}>Forgot password?</button>
            </div>
            <button type="submit" className="continue-button signin-button">{authFailed ? 'Try Again' : 'Sign In to Dashboard'}</button>
            {notice && <p className="form-notice signin-notice" role="status">{notice}</p>}
          </form>
          {authFailed ? <p className="signin-error-register">New warehouse manager? <button type="button" className="text-button" onClick={onCreateAccount}>Create Manager Account</button></p> : <>
          <div className="signin-register">
            <p>New warehouse manager?</p>
            <button type="button" className="back-button create-account-button" onClick={onCreateAccount}>Create Manager Account</button>
          </div>
          <aside className="signin-staff" aria-labelledby="signin-staff-title">
            <h3 id="signin-staff-title">Staff member?</h3>
            <p>Staff accounts sign in through the SUSUNO mobile application.</p>
          </aside>
          <p className="signin-legal">By continuing, you agree to the Terms of Service and Privacy Policy.</p>
          </>}
          {authFailed && <p className="recovery-demo">Frontend demo — use the current manager credentials. Refresh restores naura@gmail.com / Susuno123!.</p>}
        </div>
      </section>
    </main>
  );
}
