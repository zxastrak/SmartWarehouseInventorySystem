import React from 'react';
import RecoveryLayout from '../components/RecoveryLayout.jsx';

export default function PasswordUpdated({ onSignIn }) {
  return (
    <RecoveryLayout title="Password updated" description="Your manager account is secure and ready to use.">
      <div className="recovery-result updated-result">
        <div className="recovery-icon success-icon" aria-hidden="true">
          <svg width="62" height="62" viewBox="0 0 64 64" fill="none"><path d="M8 33 25 50 57 12" stroke="currentColor" strokeWidth="7" /></svg>
        </div>
        <h3>Password reset successful</h3>
        <p className="recovery-description">Use your new password the next time you sign in.</p>
        <button type="button" className="continue-button" onClick={onSignIn}>Continue to Sign In</button>
        <p className="recovery-demo">Frontend demo — no password has been changed on the server.</p>
      </div>
    </RecoveryLayout>
  );
}
