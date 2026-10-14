import React, { useEffect, useState } from 'react';
import RecoveryLayout from '../components/RecoveryLayout.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

export default function ResetPassword({ expiresAt, onUpdated, onExpired }) {
  const [values, setValues] = useState({ password: '', confirmation: '' });
  const [errors, setErrors] = useState({});
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const rules = [
    { label: 'At least 10 characters', valid: values.password.length >= 10 },
    { label: 'Uppercase and lowercase', valid: /[A-Z]/.test(values.password) && /[a-z]/.test(values.password) },
    { label: 'At least one number', valid: /\d/.test(values.password) },
    { label: 'At least one symbol', valid: /[^A-Za-z0-9\s]/.test(values.password) },
  ];
  function change(event) {
    const { name, value } = event.target;
    setValues(current => ({ ...current, [name]: value }));
    setErrors(current => ({ ...current, [name]: undefined }));
  }
  function submit(event) {
    event.preventDefault();
    if (Date.now() >= expiresAt) { setNow(Date.now()); return; }
    const next = {};
    if (!rules.every(rule => rule.valid)) next.password = 'Meet all four password requirements.';
    if (!values.confirmation) next.confirmation = 'Confirm your new password.';
    else if (values.password !== values.confirmation) next.confirmation = 'Passwords do not match.';
    setErrors(next);
    const invalid = Object.keys(next)[0];
    if (invalid) { document.getElementById(`reset-${invalid}`)?.focus(); return; }
    // Demo only. In production send a valid reset token and password to the server.
    // Continue only after API success; do not log or store the password locally.
    setValues({ password: '', confirmation: '' });
    onUpdated();
  }
  return (
    <RecoveryLayout eyebrow="SECURE YOUR ACCOUNT" title="Create a new password" description="Choose a strong password that you have not used before.">
      <form className="recovery-form reset-form" noValidate onSubmit={submit}>
        {now >= expiresAt ? (
          <div className="recovery-error" role="alert">
            <strong>This demo link has expired.</strong>
            <p>Request a new link to continue.</p>
            <button type="button" className="text-button" onClick={onExpired}>Request another link</button>
          </div>
        ) : <>
          <PasswordInput id="reset-password" name="password" label="New password" placeholder="Enter your new password"
            autoComplete="new-password" value={values.password} onChange={change} error={errors.password} />
          <PasswordInput id="reset-confirmation" name="confirmation" label="Confirm new password" placeholder="Confirm your new password"
            autoComplete="new-password" value={values.confirmation} onChange={change} error={errors.confirmation} />
          <aside className="recovery-info password-requirements">
            <h3>Password requirements</h3>
            <ul>{rules.map(rule => <li key={rule.label} className={rule.valid ? 'requirement-met' : ''}>
              <span aria-hidden="true">{rule.valid ? '✓' : '○'}</span> {rule.label}
              <span className="sr-only">{rule.valid ? ' — met' : ' — not met'}</span>
            </li>)}</ul>
          </aside>
          <button type="submit" className="continue-button">Update Password</button>
          <p className="reset-session-note">This will sign out other active sessions for security.</p>
        </>}
        <p className="recovery-demo">Frontend demo — password changes and session sign-out are simulated.</p>
      </form>
    </RecoveryLayout>
  );
}
