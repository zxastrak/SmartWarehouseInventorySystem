import React, { useEffect, useRef, useState } from 'react';
import BrandPanel from '../components/BrandPanel.jsx';
import SignUpSteps from '../components/SignUpSteps.jsx';
import FormField from '../components/FormField.jsx';

function PasswordField({ name, label, error, ...inputProps }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="form-field">
      <label htmlFor={name}>{label} <span className="required-mark" aria-hidden="true">*</span></label>
      <div className="password-input-wrap">
        <input
          {...inputProps}
          id={name} name={name} type={visible ? 'text' : 'password'} required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : undefined}
        />
        <button
          type="button" className="password-toggle"
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-controls={name}
          onClick={() => setVisible(current => !current)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {!visible && <path d="M3 3 21 21" />}
          </svg>
        </button>
      </div>
      {error && <p className="field-error" id={`${name}-error`}>{error}</p>}
    </div>
  );
}

const initialValues = {
  username: '',
  password: '',
  confirmPassword: '',
  acceptedTerms: false,
};

function validateSecurity(values) {
  const errors = {};
  if (!/^[A-Za-z0-9._-]{3,30}$/.test(values.username.trim())) {
    errors.username = 'Use 3–30 letters, numbers, dots, hyphens, or underscores.';
  }
  if (values.password.length < 8) {
    errors.password = 'Enter a password with at least 8 characters.';
  }
  if (!values.confirmPassword) {
    errors.confirmPassword = 'Confirm your password.';
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords do not match.';
  }
  if (!values.acceptedTerms) {
    errors.acceptedTerms = 'Please agree to the Terms of Service and Privacy Policy.';
  }
  return errors;
}

export default function SecuritySetup({ initialData, onBack, email, onChangeEmail, manager, warehouse, onSignIn }) {
  const [values, setValues] = useState(initialData ?? initialValues);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [complete, setComplete] = useState(false);

  function handleChange(event) {
    const { name, type, checked, value } = event.target;
    setValues(current => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    setErrors(current => ({ ...current, [name]: undefined }));
    setNotice('');
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateSecurity(values);
    setErrors(nextErrors);
    setNotice('');
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }
    // Frontend validation only. Connect the registration API here later.
    // Never log passwords or store them in localStorage/sessionStorage.
    setVerifying(true);
  }

  if (complete) {
    return <WorkspaceReady manager={manager} warehouse={warehouse} onSignIn={onSignIn} />;
  }

  if (verifying) {
    return <EmailVerification email={email} onChangeEmail={() => onChangeEmail?.(values)} onVerified={() => setComplete(true)} />;
  }

  return (
    <main className="signup-layout">
      <BrandPanel />
      <section className="form-panel security-panel" aria-labelledby="security-title">
        <div className="signup-content">
          <header className="signup-header">
            <p className="form-eyebrow">CREATE MANAGER WORKSPACE</p>
            <h2 id="security-title">Secure your account</h2>
            <p className="form-description">Create login credentials and review the manager-only access rules.</p>
          </header>
          <SignUpSteps activeStep={3} />
          <form className="manager-form security-form" noValidate onSubmit={handleSubmit}>
            <FormField
              name="username" label="Username" placeholder="Enter your username"
              autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={30}
              value={values.username} error={errors.username} onChange={handleChange}
            />
            <PasswordField
              name="password" label="Password" type="password"
              placeholder="Enter your password" autoComplete="new-password" minLength={8}
              value={values.password} error={errors.password} onChange={handleChange}
            />
            <PasswordField
              name="confirmPassword" label="Confirm password" type="password"
              placeholder="Confirm your password" autoComplete="new-password"
              value={values.confirmPassword} error={errors.confirmPassword} onChange={handleChange}
            />
            <aside className="manager-access" aria-labelledby="manager-access-title">
              <h3 id="manager-access-title">Manager access</h3>
              <p>This account can approve orders, manage staff, and change warehouse settings.</p>
              <p className="access-note">Staff accounts are created later from Staff Management.</p>
            </aside>
            <div className="terms-field">
              <label className="terms-label" htmlFor="acceptedTerms">
                <input
                  id="acceptedTerms" name="acceptedTerms" type="checkbox" required
                  checked={values.acceptedTerms} onChange={handleChange}
                  aria-invalid={Boolean(errors.acceptedTerms)}
                  aria-describedby={errors.acceptedTerms ? 'acceptedTerms-error' : undefined}
                />
                <span>I agree to the Terms of Service and Privacy Policy.</span>
              </label>
              {errors.acceptedTerms && <p id="acceptedTerms-error" className="field-error">{errors.acceptedTerms}</p>}
            </div>
            <div className="warehouse-actions security-actions">
              <button type="button" className="back-button" onClick={() => onBack?.(values)}>Back</button>
              <button type="submit" className="continue-button">Create Manager Account</button>
            </div>
            {notice && <p className="form-notice warehouse-notice" role="status">{notice}</p>}
          </form>
        </div>
      </section>
    </main>
  );
}

function EmailVerification({ email, onChangeEmail, onVerified }) {
  const [digits, setDigits] = useState(Array(6).fill(''));
  const [expiresAt, setExpiresAt] = useState(() => Date.now() + 600000);
  const [remaining, setRemaining] = useState(600);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const inputs = useRef([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  function updateDigits(index, text) {
    const numbers = text.replace(/\D/g, '').slice(0, 6 - index);
    setError('');
    setNotice('');
    setDigits(current => {
      const next = [...current];
      if (!numbers) next[index] = '';
      else numbers.split('').forEach((number, offset) => { next[index + offset] = number; });
      return next;
    });
    if (numbers) inputs.current[Math.min(index + numbers.length, 5)]?.focus();
  }

  function verify(event) {
    event.preventDefault();
    setNotice('');
    if (Date.now() >= expiresAt) {
      setError('This code has expired. Please request a new code.');
      return;
    }
    const empty = digits.findIndex(digit => !digit);
    if (empty !== -1) {
      setError('Enter all six digits.');
      inputs.current[empty]?.focus();
      return;
    }
    setError('');
    // FRONTEND DEMO ONLY. Replace this comparison with the server verification API.
    // Show WorkspaceReady in production only after the server confirms registration.
    if (digits.join('') !== '123456') {
      setError('Demo code is 123456. Please enter it to preview the next screen.');
      inputs.current[0]?.focus();
      return;
    }
    onVerified?.();
  }

  function resend() {
    // Demo only: replace this with the resend API and its server-provided expiry.
    setDigits(Array(6).fill(''));
    setExpiresAt(Date.now() + 600000);
    setError('');
    setNotice('Demo timer restarted. No email has been sent; the resend API is not connected yet.');
    inputs.current[0]?.focus();
  }

  const countdown = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;

  return (
    <main className="signup-layout">
      <BrandPanel />
      <section className="form-panel verify-panel" aria-labelledby="verify-title">
        <div className="signup-content">
          <header className="signup-header">
            <p className="form-eyebrow">VERIFY YOUR EMAIL</p>
            <h2 id="verify-title">Enter verification code</h2>
            <p className="form-description">We sent a six-digit code to {email}.</p>
          </header>
          <SignUpSteps activeStep={3} />
          <form className="verify-form" noValidate onSubmit={verify}>
            <div className="otp-inputs" role="group" aria-label="Six-digit verification code" aria-describedby={error ? 'otp-error' : undefined}>
              {digits.map((digit, index) => (
                <input
                  key={index} ref={element => { inputs.current[index] = element; }}
                  type="text" inputMode="numeric" pattern="[0-9]*"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  aria-label={`Code digit ${index + 1}`} aria-invalid={Boolean(error)}
                  value={digit}
                  onChange={event => updateDigits(index, event.target.value)}
                  onFocus={event => event.target.select()}
                  onPaste={event => {
                    event.preventDefault();
                    updateDigits(index, event.clipboardData.getData('text'));
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Backspace' && !digit && index > 0) {
                      event.preventDefault();
                      setDigits(current => current.map((value, position) => position === index - 1 ? '' : value));
                      inputs.current[index - 1]?.focus();
                    }
                    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                      event.preventDefault();
                      inputs.current[Math.max(0, Math.min(5, index + (event.key === 'ArrowLeft' ? -1 : 1)))]?.focus();
                    }
                  }}
                />
              ))}
            </div>
            {error && <p className="field-error" id="otp-error" role="alert">{error}</p>}
            <p className="code-countdown">{remaining > 0 ? `Code expires in ${countdown}` : 'Code expired'}</p>
            <button type="submit" className="continue-button verify-button">Verify Email</button>
            <p className="resend-prompt">Did not receive it? <button type="button" className="text-button" onClick={resend}>Resend code</button></p>
            <button type="button" className="text-button change-email" onClick={onChangeEmail}>← Change email address</button>
            {notice && <p className="form-notice verification-notice" role="status">{notice}</p>}
            <p className="verification-demo">Frontend demo — use code 123456. No verification email has been sent.</p>
          </form>
        </div>
      </section>
    </main>
  );
}

function WorkspaceReady({ manager, warehouse, onSignIn }) {
  const [notice, setNotice] = useState('');
  const firstName = manager?.fullName?.trim().split(/\s+/)[0] || 'Manager';
  const warehouseName = warehouse?.warehouseName || 'your warehouse';
  const warehouseCode = warehouse?.warehouseCode || '';

  return (
    <main className="signup-layout">
      <BrandPanel />
      <section className="form-panel ready-panel" aria-labelledby="ready-title">
        <div className="signup-content">
          <header className="signup-header">
            <p className="form-eyebrow">WORKSPACE READY</p>
            <h2 id="ready-title">Welcome to SUSUNO, {firstName}!</h2>
            <p className="form-description">Your manager account and {warehouseName} workspace are ready.</p>
          </header>
          <SignUpSteps activeStep={3} />
          <div className="ready-content">
            <div className="success-check" aria-hidden="true">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <path d="M8 33 25 50 57 12" stroke="currentColor" strokeWidth="7" />
              </svg>
            </div>
            <h3>Account created successfully</h3>
            <p className="ready-description">You are the primary manager for {warehouseName}{warehouseCode ? ` · ${warehouseCode}` : ''}.</p>
            <div className="ready-next-steps">
              <p>NEXT STEPS</p>
              <ol>
                <li>Review warehouse preferences</li>
                <li>Add staff accounts for the mobile application</li>
                <li>Start monitoring inventory and operations</li>
              </ol>
            </div>
            <button type="button" className="continue-button ready-button" onClick={() => {
              if (onSignIn) onSignIn();
              else setNotice('The Sign In page will be connected in the next frontend step.');
            }}>Continue to Sign In</button>
            {notice && <p className="form-notice ready-notice" role="status">{notice}</p>}
            <p className="verification-demo">Frontend demo — no account or workspace has been created on the server.</p>
          </div>
        </div>
      </section>
    </main>
  );
}