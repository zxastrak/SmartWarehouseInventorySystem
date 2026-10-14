import React from 'react';

const steps = ['Manager', 'Warehouse', 'Security'];

export default function SignUpSteps({ activeStep = 1 }) {
  return (
    <ol className="signup-steps" aria-label="Registration steps">
      {steps.map((label, index) => {
        const number = index + 1;
        const className = number === activeStep ? 'active' : number < activeStep ? 'completed' : '';
        return (
          <li key={label} className={className} aria-current={number === activeStep ? 'step' : undefined}>
            <span className="step-number">{number}</span>
            <span className="step-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
