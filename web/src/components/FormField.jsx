import React from 'react';

export default function FormField({ name, label, error, ...inputProps }) {
  return (
    <div className="form-field">
      <label htmlFor={name}>{label} <span className="required-mark" aria-hidden="true">*</span></label>
      <input id={name} name={name} required aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined} {...inputProps} />
      {error && <p className="field-error" id={`${name}-error`}>{error}</p>}
    </div>
  );
}
