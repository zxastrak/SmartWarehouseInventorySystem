import React, { useState } from 'react';
import BrandPanel from '../components/BrandPanel.jsx';
import SignUpSteps from '../components/SignUpSteps.jsx';
import FormField from '../components/FormField.jsx';

const initialValues = { fullName: '', email: '', phone: '', jobTitle: '' };

export function validateManager(values) {
  const errors = {};
  if (values.fullName.trim().length < 2) errors.fullName = 'Enter your full name (at least 2 characters).';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Enter a valid work email address.';
  const phone = values.phone.replace(/[\s().-]/g, '');
  if (!/^\+?\d{8,15}$/.test(phone)) errors.phone = 'Enter a valid phone number (8–15 digits).';
  if (!values.jobTitle.trim()) errors.jobTitle = 'Enter your job title.';
  return errors;
}

export default function SignUp({ onContinue, onSignIn, initialData }) {
  const [values, setValues] = useState(initialData ?? initialValues);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');

  function handleChange(event) {
    const { name, value } = event.target;
    setValues(current => ({ ...current, [name]: value }));
    setErrors(current => ({ ...current, [name]: undefined }));
    setNotice('');
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateManager(values);
    setErrors(nextErrors);
    setNotice('');
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }
    const manager = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]));
    // Connect to the Warehouse page later via this callback. No account is created here.
    if (onContinue) onContinue(manager);
    else setNotice('Manager details are valid. Warehouse setup will be available in the next page. No account has been created yet.');
  }

  function handleSignIn(event) {
    if (onSignIn) { event.preventDefault(); onSignIn(); }
    else {
      event.preventDefault();
      setNotice('The Sign In page is not available yet.');
    }
  }

  return (
    <main className="signup-layout">
      <BrandPanel />
      <section className="form-panel" aria-labelledby="signup-title">
        <div className="signup-content">
          <header className="signup-header">
            <p className="form-eyebrow">CREATE MANAGER WORKSPACE</p>
            <h2 id="signup-title">Tell us about you</h2>
            <p className="form-description">Create the primary manager identity for this warehouse.</p>
          </header>
          <SignUpSteps />
          <form className="manager-form" noValidate onSubmit={handleSubmit}>
            <FormField name="fullName" label="Full name" placeholder="Enter your full name" autoComplete="name" maxLength={100} value={values.fullName} error={errors.fullName} onChange={handleChange} />
            <FormField name="email" label="Work email" type="email" placeholder="Enter your work email" autoComplete="email" maxLength={254} value={values.email} error={errors.email} onChange={handleChange} />
            <FormField name="phone" label="Phone number" type="tel" placeholder="Enter your phone number" autoComplete="tel" maxLength={25} value={values.phone} error={errors.phone} onChange={handleChange} />
            <FormField name="jobTitle" label="Job title" placeholder="Enter your job title" autoComplete="organization-title" maxLength={100} value={values.jobTitle} error={errors.jobTitle} onChange={handleChange} />
            <button className="continue-button" type="submit">Continue to Warehouse Setup</button>
          </form>
          <p className="signin-prompt">Already have an account? <a href="/sign-in" onClick={handleSignIn}>Sign In</a></p>
          {notice && <p className="form-notice" role="status">{notice}</p>}
        </div>
      </section>
    </main>
  );
}
