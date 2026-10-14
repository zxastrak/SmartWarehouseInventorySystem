import React, { useState } from 'react';

export default function PasswordInput({ id, label, error, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <div className="password-input-wrap">
        <input {...props} id={id} type={visible ? 'text' : 'password'} required
          aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
        <button type="button" className="password-toggle" aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-controls={id} onClick={() => setVisible(current => !current)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {!visible && <path d="M3 3 21 21" />}
          </svg>
        </button>
      </div>
      {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
    </div>
  );
}
