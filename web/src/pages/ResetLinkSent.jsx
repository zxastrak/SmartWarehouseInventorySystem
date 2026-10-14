import React, { useEffect, useState } from 'react';
import RecoveryLayout from '../components/RecoveryLayout.jsx';

export default function ResetLinkSent({ email, expiresAt, onResend, onOpenReset, onBack }) {
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const expired = now >= expiresAt;
  return (
    <RecoveryLayout title="Check your email" description="A secure reset link has been sent to your manager email.">
      <div className="recovery-result sent-result">
        <div className="recovery-icon" aria-hidden="true">
          <svg width="58" height="58" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round">
            <rect x="6" y="13" width="52" height="38" rx="1" />
            <path d="m7 14 25 18 25-18" />
          </svg>
        </div>
        <h3>Reset link sent</h3>
        <p className="recovery-description">We sent instructions to {email}</p>
        <div className="recovery-link-info">
          <strong>{expired ? 'The demo link has expired.' : 'The link expires in 15 minutes.'}</strong>
          <p>Check spam or request another email if it does not arrive.</p>
        </div>
        <a className="continue-button email-app-button" href="mailto:">Open Email App</a>
        <button type="button" className="text-button resend-email" onClick={() => {
          onResend(); setNow(Date.now()); setNotice('Demo link renewed. No email has been sent.');
        }}>Resend email</button>
        <button type="button" className="text-button recovery-back muted-back" onClick={() => onBack(email)}>← Back to Sign In</button>
        <div className="recovery-demo">
          <p>Frontend demo — no email has been sent.</p>
          <button type="button" className="text-button" disabled={expired} onClick={onOpenReset}>Preview reset link (demo)</button>
        </div>
        {notice && <p className="form-notice recovery-notice" role="status">{notice}</p>}
      </div>
    </RecoveryLayout>
  );
}
