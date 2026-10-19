import React, { useEffect, useRef, useState } from "react";
import ManagementShell from "../components/ManagementShell.jsx";
import PasswordInput from "../components/PasswordInput.jsx";
import { staffRoles } from "../data/staff.js";
import { staffStatus, initials, managementDate, validateStaff, generateTemporaryPassword } from "../utils/staffSettings.js";
function StaffDialog({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return <dialog ref={ref} className={"ss-dialog" + (wide ? " ss-dialog-wide" : "")} aria-label={title} onCancel={onClose}><button type="button" className="inventory-close" aria-label="Close staff dialog" onClick={onClose}>×</button>{children}</dialog>;
}
const emptyForm = () => ({ fullName: "", role: "", contact: "", warehouse: "", username: "", password: "" });
function StaffManagement({ manager, warehouse, staff, warehouses, regional, onNavigate, onSignOut, onCreate, onEdit, onReset, onSuspend, initialStaffId = null }) {
  const [view, setView] = useState(initialStaffId ? "detail" : "list"), [selected, setSelected] = useState(initialStaffId), [query, setQuery] = useState(""), [role, setRole] = useState("All Roles"), [status, setStatus] = useState("All Status"), [page, setPage] = useState(1), [form, setForm] = useState(emptyForm), [errors, setErrors] = useState({}), [modal, setModal] = useState(null), [secret, setSecret] = useState(null), [edit, setEdit] = useState({ role: "", warehouse: "" }), [notice, setNotice] = useState("");
  const lock = useRef(false);
  const person = staff.find((row) => row.id === selected), filtered = staff.filter((row) => `${row.fullName} ${row.contact} ${row.username} ${row.role}`.toLowerCase().includes(query.toLowerCase()) && (role === "All Roles" || row.role === role) && (status === "All Status" || staffStatus(row) === status)), pages = Math.max(1, Math.ceil(filtered.length / 4)), active = Math.min(page, pages), visible = filtered.slice((active - 1) * 4, active * 4);
  useEffect(() => setPage(1), [query, role, status]);
  function field(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: void 0 }));
  }
  function back() {
    setView("list");
    setSelected(null);
    setForm(emptyForm());
    setErrors({});
    setNotice("");
  }
  function close() {
    setModal(null);
    setSecret(null);
    setNotice("");
  }
  function add() {
    setForm(emptyForm());
    setErrors({});
    setView("add");
    setNotice("");
  }
  function create(e) {
    e.preventDefault();
    const next = validateStaff(form, staff, warehouses);
    setErrors(next);
    if (Object.keys(next).length || lock.current) return;
    lock.current = true;
    const result = onCreate(form);
    lock.current = false;
    if (result.error) {
      setErrors({ submit: result.error });
      return;
    }
    setSelected(result.staff.id);
    setSecret({ fullName: result.staff.fullName, role: result.staff.role, username: result.staff.username, password: form.password });
    setForm((current) => ({ ...current, password: "" }));
    setModal("ready");
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(`SUSUNO demo staff account
Username: ${secret.username}
Temporary password: ${secret.password}
Requires password change at first login. Mobile backend is not connected.`);
      setNotice("Credentials copied.");
    } catch {
      setNotice("Copy is unavailable. Select the username and password shown above manually.");
    }
  }
  function action(kind) {
    setNotice("");
    setModal(kind);
    if (kind === "edit") setEdit({ role: person.role, warehouse: person.warehouse });
  }
  function saveEdit(e) {
    e.preventDefault();
    const result = onEdit(person.id, edit);
    if (result.error) {
      setNotice(result.error);
      return;
    }
    setModal(null);
    setNotice(result.unchanged ? "No account details changed." : "Staff assignment updated.");
  }
  function reset() {
    const password = generateTemporaryPassword(), result = onReset(person.id);
    if (result.error) {
      setNotice(result.error);
      return;
    }
    setSecret({ fullName: person.fullName, role: person.role, username: person.username, password });
    setModal("ready");
  }
  function suspend() {
    const result = onSuspend(person.id, !person.suspended);
    if (result.error) {
      setNotice(result.error);
      return;
    }
    setModal(null);
    setNotice(person.suspended ? "Demo mobile access reactivated." : "Demo mobile access suspended.");
  }
  const statusTag = (row) => <span className={"ss-status ss-" + staffStatus(row).toLowerCase()}>{staffStatus(row)}</span>;
  const profile = <span className="ss-avatar">{initials(person?.fullName || "Staff")}</span>;
  return <ManagementShell page="Staff Management" title={view === "add" ? "Add Staff Account" : view === "detail" ? "Staff Account Detail" : "Staff Management"} eyebrow={view === "add" ? "STAFF MANAGEMENT / ADD ACCOUNT" : "TEAM AND ACCESS"} description={view === "add" ? "Create login credentials and assign mobile access for a warehouse staff member." : view === "detail" ? "Review staff information, access status, and security actions." : "Create and manage staff accounts for the SUSUNO mobile application."} manager={manager} warehouse={warehouse} regional={regional} query={query} onSearch={setQuery} onNavigate={onNavigate} onSignOut={onSignOut}>
 {view === "list" && <><section className="ss-metrics">{[["Total Staff", staff.length, "Registered demo accounts", "green"], ["Active", staff.filter((row) => staffStatus(row) === "Active").length, "Active sample records", "green"], ["First Login Pending", staff.filter((row) => staffStatus(row) === "Pending").length, "Password change required", "rose"]].map(([label, value, caption, tone]) => <article className={"ss-metric metric-" + tone} key={label}><h2>{label}</h2><strong>{value}</strong><small>{caption}</small></article>)}</section><section className="dashboard-card ss-card"><h2>Staff Accounts</h2><p className="ss-muted">Manage staff identities and access assignments for the mobile app.</p><div className="ss-list-filters"><input aria-label="Search staff accounts" placeholder="Search staff name, role, or username..." value={query} onChange={(e) => setQuery(e.target.value)} /><select aria-label="Filter staff role" value={role} onChange={(e) => setRole(e.target.value)}><option>All Roles</option>{staffRoles.map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Filter staff status" value={status} onChange={(e) => setStatus(e.target.value)}>{["All Status", "Active", "Pending", "Suspended"].map((value) => <option key={value}>{value}</option>)}</select><button className="inbound-primary" onClick={add}>+ Add Staff Account</button></div><div className="inventory-table-wrap"><table className="ss-staff-table"><thead><tr>{["Staff", "Role", "Username", "Warehouse", "Last login", "Status", "Action"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{visible.map((row) => <tr key={row.id}><td><div className="ss-person"><span className="ss-avatar small">{initials(row.fullName)}</span><div><strong>{row.fullName}</strong><small>{row.contact}</small></div></div></td><td>{row.role}</td><td>{row.username}</td><td>{row.warehouseCode}</td><td>{row.lastLogin ? managementDate(row.lastLogin, regional, true) : "Not signed in"}</td><td>{statusTag(row)}</td><td><button className="dashboard-link" aria-label={`View staff ${row.fullName}`} onClick={() => {
    setSelected(row.id);
    setView("detail");
    setNotice("");
  }}>View ›</button></td></tr>)}{!visible.length && <tr><td colSpan="7">No staff accounts match these filters.</td></tr>}</tbody></table></div><section className="ss-callout"><strong>Mobile access</strong><p>Staff use their username and temporary password, then change the password at first login. Account provisioning and mobile sign-in are simulated until the backend is connected.</p></section><div className="inventory-pagination"><span>Showing {filtered.length ? (active - 1) * 4 + 1 : 0}–{Math.min(active * 4, filtered.length)} of {filtered.length} staff accounts</span><div>{Array.from({ length: pages }, (_, i) => <button key={i} className={active === i + 1 ? "active-page" : ""} aria-label={`Staff page ${i + 1}`} onClick={() => setPage(i + 1)}>{i + 1}</button>)}</div></div></section></>}
 {view === "add" && <form className="dashboard-card ss-card ss-staff-form" onSubmit={create} noValidate><button type="button" className="ss-back" onClick={back}>‹ Cancel and return to Staff Management</button><h2>Staff Information</h2><div className="ss-fields"><label>Full name *<input aria-label="Full name *" value={form.fullName} onChange={(e) => field("fullName", e.target.value)} maxLength={100} placeholder="Enter staff full name" aria-invalid={!!errors.fullName} />{errors.fullName && <span className="field-error">{errors.fullName}</span>}</label><label>Staff role *<select aria-label="Staff role *" value={form.role} onChange={(e) => field("role", e.target.value)}><option value="">Select staff role</option>{staffRoles.map((value) => <option key={value}>{value}</option>)}</select>{errors.role && <span className="field-error">{errors.role}</span>}</label><label>Email or phone *<input aria-label="Email or phone *" value={form.contact} onChange={(e) => field("contact", e.target.value)} placeholder="Enter work email or phone" maxLength={254} />{errors.contact && <span className="field-error">{errors.contact}</span>}</label><label>Assigned warehouse *<input type="text" autoComplete="off" placeholder="Enter assigned warehouse name" aria-label="Assigned warehouse *" value={form.warehouse} onChange={(e) => field("warehouse", e.target.value)} />{errors.warehouse && <span className="field-error">{errors.warehouse}</span>}</label></div><hr /><h2>Login Credentials</h2><p className="ss-muted">These credentials are prepared for the SUSUNO mobile application.</p><div className="ss-fields"><label>Username *<input aria-label="Username *" value={form.username} onChange={(e) => field("username", e.target.value)} placeholder="Enter a unique username" autoComplete="off" maxLength={30} />{errors.username && <span className="field-error">{errors.username}</span>}</label><div><PasswordInput id="staff-password" label="Temporary password *" placeholder="Generate or enter temporary password" value={form.password} onChange={(e) => field("password", e.target.value)} error={errors.password} autoComplete="new-password" maxLength={128} /><button type="button" className="dashboard-link ss-generate" onClick={() => field("password", generateTemporaryPassword())}>Generate</button></div></div><section className="ss-callout rose"><strong>First-login security</strong><p>✓ Require a new password after the first successful mobile login.</p><small>The temporary password is shown once after creation. Do not use a real personal password in this demo.</small></section>{errors.submit && <p role="alert" className="field-error">{errors.submit}</p>}<div className="ss-actions"><button type="button" className="inbound-secondary" onClick={back}>Cancel</button><button className="inbound-primary">Create Staff Account</button></div></form>}
 {view === "detail" && person && <section className="dashboard-card ss-card"><button className="ss-back" onClick={back}>‹ Back to Staff Management</button><div className="ss-staff-heading">{profile}<div><h2>{person.fullName}</h2><p className="ss-muted">{person.role} · {person.warehouse}</p></div>{statusTag(person)}</div><div className="ss-detail-grid"><section className="ss-inset"><h2>Account Information</h2><dl className="ss-information">{[["Full name", person.fullName], ["Role", person.role], ["Username", person.username], [person.contact.includes("@") ? "Email" : "Phone", person.contact], ["Created", managementDate(person.createdAt, regional) + " \xB7 " + person.createdBy], ["Last login", person.lastLogin ? managementDate(person.lastLogin, regional, true) : "Not signed in"]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section><section className="ss-access"><h2>Mobile Access</h2><div className={"ss-callout" + (staffStatus(person) === "Active" ? "" : " rose")}><strong>{person.suspended ? "Mobile access suspended" : person.requirePasswordChange ? person.lastLogin ? "Password change pending" : "Waiting for first login" : "Mobile access active"}</strong><p>{person.suspended ? "Reactivate this demo account to restore its previous access state." : person.requirePasswordChange ? "A temporary credential has been issued. Mobile first login is not connected." : `Password changed on ${managementDate(person.passwordChangedAt, regional)} \xB7 Sample record`}</p></div><h3>Security actions</h3><button className="inbound-secondary" disabled={person.suspended} onClick={() => action("reset")}>Reset Temporary Password</button><button className="inbound-secondary" onClick={() => action("edit")}>Edit Role or Warehouse</button><button className={person.suspended ? "inbound-secondary" : "ss-danger"} onClick={() => action("suspend")}>{person.suspended ? "Reactivate Mobile Access" : "Suspend Mobile Access"}</button></section></div><section className="ss-callout"><strong>Access principle</strong><p>Assignments describe intended mobile access. Backend role checks and real staff login are not connected in this frontend demo.</p></section></section>}
 {notice && !modal && <p role="status" className="form-notice">{notice}</p>}
 {modal && <StaffDialog title={modal === "ready" ? "Account is ready" : modal === "edit" ? "Edit Role or Warehouse" : modal === "reset" ? "Reset Temporary Password" : "Confirm Mobile Access"} onClose={close} wide={modal === "ready"}>
 {modal === "ready" && secret ? <><div className="ss-success">✓</div><h2>Account is ready</h2><p className="ss-muted ss-center">Credentials are prepared for this frontend demo. Mobile authentication is not connected.</p><section className="ss-inset ss-credentials"><small>STAFF</small><strong>{secret.fullName} · {secret.role}</strong><dl className="ss-information"><div><dt>Username</dt><dd>{secret.username}</dd></div><div><dt>Temporary password</dt><dd className="ss-secret">{secret.password}</dd></div></dl><small className="ss-red">Shown once · Must be changed at first login</small></section><section className="ss-callout"><strong>Next step for staff</strong><p>Mobile sign-in → temporary password → create a new password, once the mobile backend is connected.</p></section>{notice && <p role="status" className="form-notice">{notice}</p>}<div className="ss-actions three"><button className="inbound-secondary" onClick={copy}>Copy Credentials</button><button className="inbound-secondary" onClick={() => {
    close();
    setView("detail");
  }}>View Staff Detail</button><button className="inbound-primary" onClick={() => {
    close();
    back();
  }}>Done</button></div></> : modal === "edit" ? <form onSubmit={saveEdit}><h2>Edit Role or Warehouse</h2><div className="ss-fields single"><label>Staff role<select aria-label="Staff role" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>{staffRoles.map((value) => <option key={value}>{value}</option>)}</select></label><label>Assigned warehouse<input type="text" autoComplete="off" placeholder="Enter assigned warehouse name" aria-label="Assigned warehouse" value={edit.warehouse} onChange={(e) => setEdit({ ...edit, warehouse: e.target.value })} /></label></div>{notice && <p role="alert" className="field-error">{notice}</p>}<div className="ss-actions"><button type="button" className="inbound-secondary" onClick={close}>Cancel</button><button className="inbound-primary">Save Assignment</button></div></form> : <><h2>{modal === "reset" ? "Reset Temporary Password" : person?.suspended ? "Reactivate Mobile Access" : "Suspend Mobile Access"}</h2><p className="ss-muted">{modal === "reset" ? "Prepare a new temporary credential and mark this account as pending password change." : person?.suspended ? "Restore the previous demo access state for this staff account?" : "Suspend this staff account in the demo. Its history is retained."}</p><p><strong>{person?.fullName}</strong></p>{notice && <p role="alert" className="field-error">{notice}</p>}<div className="ss-actions"><button className="inbound-secondary" onClick={close}>Cancel</button><button className="inbound-primary" onClick={modal === "reset" ? reset : suspend}>{modal === "reset" ? "Reset Password" : "Confirm"}</button></div></>}
 </StaffDialog>}
 </ManagementShell>;
}
export {
  StaffManagement as default
};
