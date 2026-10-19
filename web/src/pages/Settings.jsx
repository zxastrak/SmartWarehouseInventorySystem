import React, { useEffect, useRef, useState } from "react";
import ManagementShell from "../components/ManagementShell.jsx";
import PasswordInput from "../components/PasswordInput.jsx";
import { defaultPreferences, initials, managementDate, validateProfile, strongPassword } from "../utils/staffSettings.js";
const tabs = ["General", "Notifications", "Security", "Appearance & Regional"];
function Toggle({ label, description, checked, onChange, disabled = false }) {
  return <label className={"ss-toggle-row" + (disabled ? " disabled" : "")}><span><strong>{label}</strong>{description && <small>{description}</small>}</span><input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} /></label>;
}
function SettingsDialog({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return <dialog ref={ref} className={"ss-dialog" + (wide ? " ss-dialog-wide" : "")} aria-label={title} onCancel={onClose}><button type="button" className="inventory-close" aria-label="Close settings dialog" onClick={onClose}>×</button>{children}</dialog>;
}
function Settings({ manager, warehouse, preferences, warehouses, onNavigate, onSignOut, onSaveProfile, onSavePreferences, onChangePassword, onRevokeSessions, otherSessions, currentSession, securityEvents, initialView = "home" }) {
  const [tab, setTab] = useState("General"), [view, setView] = useState(initialView), [draft, setDraft] = useState(() => structuredClone(preferences)), [profile, setProfile] = useState(() => ({ ...manager })), [errors, setErrors] = useState({}), [modal, setModal] = useState(null), [notice, setNotice] = useState(""), [query, setQuery] = useState(""), [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" }), [code, setCode] = useState(""), [success, setSuccess] = useState(""), [twoStepTarget, setTwoStepTarget] = useState(true);
  const photoInput = useRef(null);
  useEffect(() => setDraft(structuredClone(preferences)), [preferences]);
  useEffect(() => setProfile({ ...manager }), [manager]);
  const regional = preferences.appearance;
  function section(next, sub = "home") {
    setTab(next);
    setView(sub);
    setDraft(structuredClone(preferences));
    setProfile({ ...manager });
    setErrors({});
    setNotice("");
  }
  function edit(group, key, value) {
    setDraft((current) => ({ ...current, [group]: { ...current[group], [key]: value } }));
    setNotice("");
  }
  function close() {
    setModal(null);
    setPasswords({ current: "", next: "", confirm: "" });
    setCode("");
    setErrors({});
  }
  function saved(label) {
    setSuccess(label);
    setModal("success");
    setNotice("");
  }
  function saveGroup(group, label) {
    const result = onSavePreferences(group, draft[group]);
    if (result.error) {
      setNotice(result.error);
      return;
    }
    if (result.unchanged) {
      setNotice("No preferences changed.");
      return;
    }
    saved(label);
  }
  function saveProfile(e) {
    e.preventDefault();
    const next = validateProfile(profile);
    setErrors(next);
    if (Object.keys(next).length) return;
    const result = onSaveProfile(profile);
    if (result.error) {
      setErrors({ submit: result.error });
      return;
    }
    if (result.unchanged) {
      section("General");
      return;
    }
    setView("home");
    saved("Manager profile");
  }
  function choosePhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setErrors((current) => ({ ...current, photo: "Choose a JPG or PNG image up to 2 MB." }));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setErrors((current) => ({ ...current, photo: "This image could not be read." }));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => setErrors((current) => ({ ...current, photo: "Choose a valid JPG or PNG image." }));
      image.onload = () => {
        setProfile((current) => ({ ...current, photo: reader.result }));
        setErrors((current) => ({ ...current, photo: void 0 }));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
  function changePassword(e) {
    e.preventDefault();
    const next = {};
    if (!passwords.current) next.current = "Enter the current demo password.";
    if (!strongPassword(passwords.next)) next.next = "Use at least 10 characters with a letter, number, and symbol; no spaces.";
    if (passwords.next !== passwords.confirm) next.confirm = "Passwords do not match.";
    if (passwords.current === passwords.next) next.next = "Choose a different password.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const result = onChangePassword(passwords.current, passwords.next);
    if (result.error) {
      setErrors({ current: result.error });
      return;
    }
    close();
    saved("Manager password \xB7 frontend demo");
  }
  function twoStep() {
    setTwoStepTarget(!preferences.security.twoStep);
    setModal("two-step");
    setCode("");
    setErrors({});
  }
  function verifyTwoStep(e) {
    e.preventDefault();
    if (code !== "123456") {
      setErrors({ code: "Use the six-digit demo code 123456." });
      return;
    }
    const result = onSavePreferences("security", { ...preferences.security, twoStep: twoStepTarget });
    if (result.error) {
      setErrors({ code: result.error });
      return;
    }
    close();
    saved(twoStepTarget ? "Two-step verification enabled \xB7 demo" : "Two-step verification disabled \xB7 demo");
  }
  function quickNotifications(value) {
    const result = onSavePreferences("notifications", { ...preferences.notifications, enabled: value });
    setNotice(result.error || `Notifications ${value ? "enabled" : "paused"} for this demo.`);
  }
  function search(value) {
    setQuery(value);
    if (!value.trim()) return;
    const q = value.toLowerCase();
    const match = q.includes("password") || q.includes("session") || q.includes("security") || q.includes("2fa") ? "Security" : q.includes("notification") || q.includes("alert") ? "Notifications" : q.includes("theme") || q.includes("language") || q.includes("regional") || q.includes("time") || q.includes("appearance") ? "Appearance & Regional" : q.includes("profile") || q.includes("warehouse") || q.includes("general") ? "General" : null;
    if (match) section(match);
    else setNotice("Search for profile, warehouse, notifications, password, theme, or regional.");
  }
  const avatar = (data, size = "") => <span className={"ss-avatar " + size}>{data.photo ? <img src={data.photo} alt="Manager avatar" /> : initials(data.fullName || "Naura")}</span>;
  const actions = (save, label, cancel) => <div className="ss-actions">{cancel && <button type="button" className="inbound-secondary" onClick={cancel}>Cancel</button>}<button type="button" className="inbound-primary" onClick={save}>{label}</button></div>;
  return <ManagementShell page="Settings" title="Settings" eyebrow="SYSTEM PREFERENCES" description="Manage your profile, warehouse preferences, notifications, and security." manager={manager} warehouse={warehouse} query={query} onSearch={search} regional={regional} onNavigate={onNavigate} onSignOut={onSignOut}><nav className="dashboard-card ss-tabs" aria-label="Settings sections">{tabs.map((label) => <button key={label} type="button" aria-current={tab === label ? "page" : void 0} className={tab === label ? "selected" : ""} onClick={() => section(label)}>{label}</button>)}</nav>
 {tab === "General" && view === "home" && <><div className="ss-general-grid"><section className="dashboard-card ss-card"><h2>Manager Profile</h2><div className="ss-profile-summary">{avatar(manager)}<div><h3>{manager.fullName}</h3><p>{manager.jobTitle || "Warehouse Manager"}</p><small>{manager.email}{manager.phone ? " \xB7 " + manager.phone : ""}</small></div></div><div className="ss-profile-bottom"><span>Account ID</span><strong>MGR-001</strong><button className="inbound-secondary" onClick={() => section("General", "profile")}>Edit Profile</button></div></section><section className="dashboard-card ss-card"><h2>Current Warehouse</h2><p className="ss-muted">Default warehouse for this account.</p><section className="ss-callout"><small>{warehouse.warehouseName.toUpperCase()}</small><h3>{warehouse.warehouseCode}</h3><p>{warehouse.city || "City not recorded"}</p></section><button className="inbound-secondary ss-full" onClick={() => section("General", "warehouse")}>Manage Warehouse Preferences</button></section></div><section className="dashboard-card ss-card"><h2>Quick Settings</h2><p className="ss-muted">Common preferences for your manager account.</p><div className="ss-quick-grid"><Toggle label="Notifications" description={preferences.notifications.enabled ? "Alerts for stock, orders, and approvals \xB7 enabled" : "Notification preferences paused"} checked={preferences.notifications.enabled} onChange={quickNotifications} /><Toggle label="Two-step verification" description={preferences.security.twoStep ? "Enabled for demo manager sign-in" : "Not enabled"} checked={preferences.security.twoStep} onChange={twoStep} /><div className="ss-setting-link"><div><strong>Language</strong><small>{regional.language === "id-ID" ? "Indonesian regional formats" : "English (United States)"}</small></div><button className="dashboard-link" onClick={() => section("Appearance & Regional")}>Change ›</button></div><div className="ss-setting-link"><div><strong>Time zone</strong><small>{regional.timeZone}</small></div><button className="dashboard-link" onClick={() => section("Appearance & Regional")}>Change ›</button></div></div></section></>}
 {tab === "General" && view === "profile" && <form className="dashboard-card ss-card ss-profile-form" onSubmit={saveProfile} noValidate><button type="button" className="ss-back" onClick={() => section("General")}>‹ Back to General Settings</button><h2>Profile Information</h2><div className="ss-photo-edit">{avatar(profile, "large")}<div><button type="button" className="inbound-secondary" onClick={() => photoInput.current.click()}>Change Photo</button><small>JPG or PNG · Maximum 2 MB</small><input ref={photoInput} type="file" accept="image/png,image/jpeg" aria-label="Manager photo" hidden onChange={choosePhoto} />{errors.photo && <p className="field-error">{errors.photo}</p>}</div></div><div className="ss-fields">{[["fullName", "Full name *"], ["jobTitle", "Job title"], ["email", "Email *"], ["phone", "Phone number"]].map(([key, label]) => <label key={key}>{label}<input aria-label={label} type={key === "email" ? "email" : key === "phone" ? "tel" : "text"} value={profile[key] || ""} maxLength={key === "email" ? 254 : 100} onChange={(e) => {
    setProfile({ ...profile, [key]: e.target.value });
    setErrors({ ...errors, [key]: void 0 });
  }} />{errors[key] && <span className="field-error">{errors[key]}</span>}</label>)}</div><section className="ss-inset ss-role"><div><small>ACCOUNT ROLE</small><strong>Warehouse Manager</strong></div><span>Role changes require administrator approval.</span></section>{errors.submit && <p className="field-error" role="alert">{errors.submit}</p>}<div className="ss-actions"><button type="button" className="inbound-secondary" onClick={() => section("General")}>Cancel</button><button className="inbound-primary">Save Profile</button></div></form>}
 {tab === "General" && view === "warehouse" && <section className="dashboard-card ss-card"><button className="ss-back" onClick={() => section("General")}>‹ Back to General Settings</button><h2>Warehouse Defaults</h2><div className="ss-fields"><label>Default warehouse *<input type="text" autoComplete="off" placeholder="Enter registered warehouse name" aria-label="Default warehouse *" value={draft.warehouse.name} onChange={(e) => edit("warehouse", "name", e.target.value)} /></label><label>Default rack sorting<select aria-label="Default rack sorting" value={draft.warehouse.rackSort} onChange={(e) => edit("warehouse", "rackSort", e.target.value)}><option value="asc">Rack code ascending</option><option value="desc">Rack code descending</option></select></label><label>Low-stock warning threshold<select aria-label="Low-stock warning threshold" value={draft.warehouse.lowThreshold} onChange={(e) => edit("warehouse", "lowThreshold", e.target.value)}><option value="reorder">At reorder level</option><option value="critical">Critical stock only</option></select></label><label>Stockout prediction window<select aria-label="Stockout prediction window" value={draft.warehouse.predictionDays} onChange={(e) => edit("warehouse", "predictionDays", Number(e.target.value))}>{[7, 14, 30].map((value) => <option key={value} value={value}>{value} days before estimated stockout</option>)}</select></label></div><hr /><h2>Operational Rules</h2><div className="ss-toggle-stack"><Toggle label="Require manager approval for stock adjustments" description="Preference for staff submissions when mobile is connected." checked={draft.warehouse.approvalRequired} onChange={(value) => edit("warehouse", "approvalRequired", value)} /><Toggle label="Allow partial purchase-order receipt" description="Record accepted quantities before a purchase order is complete." checked={draft.warehouse.allowPartial} onChange={(value) => edit("warehouse", "allowPartial", value)} /></div><p className="ss-muted ss-note">Partial-receipt rules and rack sorting apply to this demo. Alert thresholds and forecast-window preferences are saved for future notification integration.</p>{actions(() => saveGroup("warehouse", "Warehouse preferences"), "Save Preferences", () => section("General"))}</section>}
 {tab === "Notifications" && <section className="dashboard-card ss-card"><h2>Notification Channels</h2><p className="ss-muted">Choose where alerts should be delivered. No email is sent by this demo.</p>{!preferences.notifications.enabled && <p className="ss-callout">Notifications are paused in Quick Settings. Your individual preferences are retained.</p>}<div className="ss-quick-grid"><Toggle label="In-app notifications" description="Bell alerts inside the manager dashboard" checked={draft.notifications.inApp} onChange={(value) => edit("notifications", "inApp", value)} /><Toggle label="Email notifications" description={"Send alerts to " + manager.email} checked={draft.notifications.email} onChange={(value) => edit("notifications", "email", value)} /></div><h2 className="ss-section-title">Events</h2><div className="ss-toggle-stack">{[["critical", "Critical stock alerts", "Low stock, stockout, and predicted stockout"], ["approvals", "Approval requests", "Purchase orders and staff stock adjustments awaiting review"], ["shipments", "Shipment updates", "In transit, delayed, partially received, and completed"], ["staff", "Staff account activity", "First login, failed login, password reset"]].map(([key, label, caption]) => <Toggle key={key} label={label} description={caption} checked={draft.notifications[key]} onChange={(value) => edit("notifications", key, value)} />)}</div>{actions(() => saveGroup("notifications", "Notification preferences"), "Save Notifications")}</section>}
 {tab === "Security" && <div className="ss-security-grid"><section className="dashboard-card ss-card"><h2>Password & Authentication</h2><div className="ss-setting-link"><div><strong>Password</strong><small>{currentSession.passwordChangedAt ? "Last changed " + managementDate(currentSession.passwordChangedAt, regional) : "Not changed in this demo session"}</small></div><button className="inbound-secondary" onClick={() => {
    setModal("password");
    setErrors({});
  }}>Change Password</button></div><section className={"ss-two-step ss-callout" + (preferences.security.twoStep ? "" : " rose")}><div><strong>Two-step verification</strong><p>{preferences.security.twoStep ? "Demo code required after entering your manager password." : "Add a verification step after entering your password."}</p><small>Frontend simulation · Demo code 123456</small></div><button className="inbound-primary" onClick={twoStep}>{preferences.security.twoStep ? "Disable 2FA" : "Enable 2FA"}</button></section><h2 className="ss-section-title">Login Protection</h2><div className="ss-toggle-stack"><Toggle label="Login alerts" description="Save a preference for alerts when a new device signs in." checked={draft.security.loginAlerts} onChange={(value) => edit("security", "loginAlerts", value)} /><label className="ss-setting-link"><div><strong>Auto sign-out</strong><small>End this frontend session after inactivity</small></div><select aria-label="Auto sign-out" value={draft.security.idleMinutes} onChange={(e) => edit("security", "idleMinutes", Number(e.target.value))}>{[15, 30, 60].map((value) => <option key={value} value={value}>{value} minutes</option>)}</select></label></div><button className="inbound-primary ss-full ss-security-save" onClick={() => saveGroup("security", "Security preferences")}>Save Security Settings</button></section><section className="dashboard-card ss-card"><h2>Active Sessions</h2><p className="ss-muted">Current browser session and a clearly labeled sample device.</p><section className="ss-callout"><strong>Current session</strong><p><b>{currentSession.browser}</b></p><small>Signed in {managementDate(currentSession.startedAt, regional, true)}</small><p className="ss-muted">Location and IP not recorded</p></section>{otherSessions.length ? otherSessions.map((row) => <section className="ss-inset ss-session" key={row.id}><strong>{row.name}</strong><p>{row.description}</p><small>Demo session · No actual device connected</small><button className="dashboard-link ss-red" onClick={() => setModal("sessions")}>Sign out</button></section>) : <p className="ss-muted">No other demo sessions.</p>}<button className="inbound-secondary ss-full ss-red" disabled={!otherSessions.length} onClick={() => setModal("sessions")}>Sign Out Other Sessions</button><section className="ss-inset ss-recent"><h3>Recent security activity</h3>{securityEvents.length ? securityEvents.slice(0, 4).map((row) => <div key={row.id}><span>{row.action}</span><small>{managementDate(row.date, regional)}</small></div>) : <p>No activity recorded.</p>}</section></section></div>}
 {tab === "Appearance & Regional" && <section className="dashboard-card ss-card"><h2>Appearance</h2><p className="ss-muted">Theme changes apply to Settings and Staff Management after saving.</p><h3>Theme</h3><div className="ss-theme-options" role="radiogroup" aria-label="Theme">{[["light", "Light"], ["dark", "Dark"], ["system", "System Default"]].map(([value, label]) => <label key={value} className={draft.appearance.theme === value ? "selected" : ""}><input type="radio" name="theme" value={value} checked={draft.appearance.theme === value} onChange={() => edit("appearance", "theme", value)} /><span className={"ss-theme-swatch " + value}><i /></span><strong>{label}</strong></label>)}</div><hr /><h2>Regional Format</h2><div className="ss-fields"><label>Language<select aria-label="Language" value={draft.appearance.language} onChange={(e) => edit("appearance", "language", e.target.value)}><option value="en-US">English (United States)</option><option value="id-ID">Indonesian (regional formats)</option></select></label><label>Time zone<select aria-label="Time zone" value={draft.appearance.timeZone} onChange={(e) => edit("appearance", "timeZone", e.target.value)}><option>Asia/Jakarta</option><option>Asia/Makassar</option><option>Asia/Jayapura</option></select></label><label>Date format<select aria-label="Date format" value={draft.appearance.dateFormat} onChange={(e) => edit("appearance", "dateFormat", e.target.value)}><option value="medium">DD MMM YYYY</option><option value="numeric">Numeric date</option></select><small>Preview: {managementDate((/* @__PURE__ */ new Date()).toISOString(), draft.appearance)}</small></label><label>Number and currency<select aria-label="Number and currency" value={draft.appearance.numberLocale} onChange={(e) => edit("appearance", "numberLocale", e.target.value)}><option value="id-ID">Indonesia · Rp1.250.000</option><option value="en-US">English formatting · IDR 1,250,000</option></select><small>Preview: {new Intl.NumberFormat(draft.appearance.numberLocale, { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(125e4)}</small></label></div><p className="ss-muted ss-note">Regional formats apply to Settings and Staff Management. Menu text remains English; operational reports retain their source formats and currencies.</p><div className="ss-actions"><button className="inbound-secondary" onClick={() => {
    setDraft({ ...draft, appearance: structuredClone(defaultPreferences.appearance) });
    setNotice("Defaults selected. Save Appearance to apply.");
  }}>Reset Defaults</button><button className="inbound-primary" onClick={() => saveGroup("appearance", "Appearance and regional preferences")}>Save Appearance</button></div></section>}
 {notice && <p role="status" className="form-notice">{notice}</p>}<p className="dashboard-demo">Preferences and account changes are stored only for this frontend session. Refresh restores the demo defaults.</p>
 {modal && <SettingsDialog title={modal === "success" ? "Changes saved successfully" : modal === "password" ? "Change Password" : modal === "two-step" ? "Two-step Verification" : "Sign Out Other Sessions"} onClose={close} wide={modal === "success"}>
 {modal === "success" ? <><div className="ss-success">✓</div><h2>Changes saved successfully</h2><p className="ss-muted ss-center">Your changes are applied to this frontend session.</p><section className="ss-inset ss-success-summary"><small>UPDATED</small><strong>{success}</strong><dl className="ss-information"><div><dt>Saved by</dt><dd>{manager.fullName} · Warehouse Manager</dd></div></dl></section><button className="inbound-primary ss-full" onClick={close}>Back to Settings</button><p className="ss-muted ss-center">Changes are recorded in the Audit Trail.</p></> : modal === "password" ? <form onSubmit={changePassword} noValidate><h2>Change Password</h2><p className="ss-muted">Update the demo manager credential for this session.</p><hr /><div className="ss-password-fields">{[["current", "Current password"], ["next", "New password"], ["confirm", "Confirm new password"]].map(([key, label]) => <PasswordInput key={key} id={"settings-password-" + key} label={label} value={passwords[key]} onChange={(e) => {
    setPasswords({ ...passwords, [key]: e.target.value });
    setErrors({ ...errors, [key]: void 0 });
  }} autoComplete={key === "current" ? "current-password" : "new-password"} maxLength={128} error={errors[key]} />)}</div><p className="ss-password-rules">At least 10 characters · Letter · Number · Symbol</p><div className="ss-actions"><button type="button" className="inbound-secondary" onClick={close}>Cancel</button><button className="inbound-primary">Update Password</button></div></form> : modal === "two-step" ? <form onSubmit={verifyTwoStep}><h2>{twoStepTarget ? "Enable" : "Disable"} Two-step Verification</h2><p className="ss-muted">Confirm this demo change with code 123456. No email or SMS is sent.</p><label>Verification code<input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} maxLength={6} inputMode="numeric" autoComplete="one-time-code" required /></label>{errors.code && <p role="alert" className="field-error">{errors.code}</p>}<div className="ss-actions"><button type="button" className="inbound-secondary" onClick={close}>Cancel</button><button className="inbound-primary">Confirm Verification</button></div></form> : <><h2>Sign Out Other Sessions</h2><p className="ss-muted">Remove the sample mobile session from this demo? Your current browser session stays signed in. No external device is contacted.</p><div className="ss-actions"><button className="inbound-secondary" onClick={close}>Cancel</button><button className="inbound-primary" onClick={() => {
    onRevokeSessions();
    close();
    saved("Other demo sessions removed");
  }}>Confirm Sign Out</button></div></>}
 </SettingsDialog>}
 </ManagementShell>;
}
export {
  Settings as default
};
