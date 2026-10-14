import React, { useState } from 'react';
import BrandPanel from '../components/BrandPanel.jsx';
import SignUpSteps from '../components/SignUpSteps.jsx';
import FormField from '../components/FormField.jsx';

const timeZones = [
  { value: 'Asia/Jakarta', label: 'Asia/Jakarta · GMT+7' },
  { value: 'Asia/Makassar', label: 'Asia/Makassar · GMT+8' },
  { value: 'Asia/Jayapura', label: 'Asia/Jayapura · GMT+9' },
];

const initialValues = {
  organization: '',
  warehouseName: '',
  warehouseCode: '',
  city: '',
  timeZone: 'Asia/Jakarta',
};

function validateWarehouse(values) {
  const errors = {};
  if (values.organization.trim().length < 2) {
    errors.organization = 'Enter your organization or company name.';
  }
  if (values.warehouseName.trim().length < 2) {
    errors.warehouseName = 'Enter your warehouse name.';
  }
  if (!/^[A-Za-z0-9_-]{2,20}$/.test(values.warehouseCode.trim())) {
    errors.warehouseCode = 'Use 2–20 letters, numbers, hyphens, or underscores.';
  }
  if (values.city.trim().length < 2) {
    errors.city = 'Enter your city.';
  }
  if (!timeZones.some(zone => zone.value === values.timeZone)) {
    errors.timeZone = 'Select a time zone.';
  }
  return errors;
}

export default function WarehouseSetup({ initialData, onBack, onContinue }) {
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
    const nextErrors = validateWarehouse(values);
    setErrors(nextErrors);
    setNotice('');
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }
    const warehouse = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, value.trim()])
    );
    // Connect the Security page here after its design is implemented.
    if (onContinue) onContinue(warehouse);
    else setNotice('Warehouse details are valid. The Security step is not available yet. No account has been created.');
  }

  return (
    <main className="signup-layout">
      <BrandPanel />
      <section className="form-panel warehouse-panel" aria-labelledby="warehouse-title">
        <div className="signup-content">
          <header className="signup-header">
            <p className="form-eyebrow">CREATE MANAGER WORKSPACE</p>
            <h2 id="warehouse-title">Set up your warehouse</h2>
            <p className="form-description">This becomes the default workspace after your first sign in.</p>
          </header>
          <SignUpSteps activeStep={2} />
          <form className="manager-form warehouse-form" noValidate onSubmit={handleSubmit}>
            <FormField
              name="organization" label="Organization or company"
              placeholder="Enter your organization or company"
              autoComplete="organization" maxLength={120}
              value={values.organization} error={errors.organization} onChange={handleChange}
            />
            <FormField
              name="warehouseName" label="Warehouse name"
              placeholder="Enter your warehouse name" maxLength={100}
              value={values.warehouseName} error={errors.warehouseName} onChange={handleChange}
            />
            <FormField
              name="warehouseCode" label="Warehouse code"
              placeholder="e.g., WH-01" maxLength={20} autoCapitalize="characters"
              value={values.warehouseCode} error={errors.warehouseCode} onChange={handleChange}
            />
            <div className="warehouse-two-columns">
              <FormField
                name="city" label="City" placeholder="Enter your city"
                autoComplete="address-level2" maxLength={100}
                value={values.city} error={errors.city} onChange={handleChange}
              />
              <div className="form-field">
                <label htmlFor="timeZone">Time zone <span className="required-mark" aria-hidden="true">*</span></label>
                <select
                  id="timeZone" name="timeZone" required value={values.timeZone}
                  aria-invalid={Boolean(errors.timeZone)}
                  aria-describedby={errors.timeZone ? 'timeZone-error' : undefined}
                  onChange={handleChange}
                >
                  {timeZones.map(zone => <option key={zone.value} value={zone.value}>{zone.label}</option>)}
                </select>
                {errors.timeZone && <p id="timeZone-error" className="field-error">{errors.timeZone}</p>}
              </div>
            </div>
            <div className="warehouse-actions">
              <button type="button" className="back-button" onClick={() => onBack?.(values)}>Back</button>
              <button type="submit" className="continue-button">Continue to Security</button>
            </div>
            {notice && <p className="form-notice warehouse-notice" role="status">{notice}</p>}
          </form>
        </div>
      </section>
    </main>
  );
}
