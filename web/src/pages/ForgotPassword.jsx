import React, { useState } from 'react';
import RecoveryLayout from '../components/RecoveryLayout.jsx';

export default function ForgotPassword({ initialEmail = '', onSend, onBack }) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState('');
  function submit(event) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid work email address.');
      document.getElementById('recovery-email')?.focus();
      return;
    }
    // Demo only. Replace onSend with a password recovery API request.
    onSend(email.trim());
  }
  return (
    <RecoveryLayout title="Forgot your password?" description="Enter the work email registered to your manager account.">
      <form className="recovery-form forgot-form" noValidate onSubmit={submit}>
        <div className="form-field">
          <label htmlFor="recovery-email">Work email</label>
          <input id="recovery-email" type="email" required autoComplete="email" autoCapitalize="none"
            placeholder="Enter your work email" value={email}
            onChange={event => { setEmail(event.target.value); setError(''); }}
            aria-invalid={Boolean(error)} aria-describedby={error ? 'recovery-email-error' : undefined} />
          {error && <p id="recovery-email-error" className="field-error">{error}</p>}
        </div>
        <button className="continue-button" type="submit">Send Reset Link</button>
        <aside className="recovery-info">
          <h3>For manager accounts only</h3>
          <p>Staff password resets are handled through Staff Management.</p>
        </aside>
        <button type="button" className="text-button recovery-back" onClick={() => onBack(email.trim())}>← Back to Sign In</button>
        <p className="recovery-demo">Frontend demo — no email will be sent.</p>
      </form>
    </RecoveryLayout>
  );
}
