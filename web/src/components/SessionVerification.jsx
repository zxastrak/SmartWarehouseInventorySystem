import React, { useState } from "react";
import "../styles/staffSettings.css";
export default function SessionVerification({ onVerify, onCancel }) {
  const [code, setCode] = useState(""), [error, setError] = useState("");
  function submit(e) {
    e.preventDefault();
    if (code !== "123456") {
      setError("Enter the six-digit demo code 123456.");
      return;
    }
    onVerify();
  }
  return <main className="ss-verification"><form className="dashboard-card" onSubmit={submit}><img src="/assets/susuno-logo.png" alt="SUSUNO" /><h1>Two-step verification</h1><p>Complete the enabled verification step to open your manager dashboard.</p><label>Verification code<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus required /></label>{error && <p className="field-error" role="alert">{error}</p>}<p className="ss-muted">Frontend demo · Use 123456. No SMS or email is sent.</p><div className="ss-actions"><button type="button" className="inbound-secondary" onClick={onCancel}>Back to Sign In</button><button className="inbound-primary">Verify & Continue</button></div></form></main>;
}
