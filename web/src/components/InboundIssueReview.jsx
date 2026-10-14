import React, {useEffect, useRef, useState} from 'react';
import {issueChoices} from '../data/inboundIssues.js';
import {issueImpact} from '../utils/inboundIssues.js';
import {completedTime} from '../utils/completedReceiving.js';
import '../styles/inboundIssues.css';

export default function InboundIssueReview({shipment, onResolve, onContinue, onBack}) {
  const [choice, setChoice] = useState(shipment.issueResolution?.choice || '');
  const [notes, setNotes] = useState(shipment.issueResolution?.notes || '');
  const [notify, setNotify] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef(null), messageRef = useRef(null), submitting = useRef(false);
  const resolution = shipment.issueResolution;
  const impact = issueImpact(shipment, choice);
  const option = issueChoices.find(value => value.id === choice);
  const issue = shipment.issue;
  const message = `${shipment.supplier}\nShipment ${shipment.id} / ${shipment.po}\n${(issue?.items || []).map(row => `${row.name} (${row.sku}): ${row.received} received, ${row.damaged} damaged, ${row.rejected} rejected. ${row.description}`).join('\n')}\n${notes.trim() ? 'Resolution notes: ' + notes.trim() : 'Please advise on the reported issue.'}`;
  useEffect(() => {if (modal && !dialogRef.current.open) dialogRef.current.showModal(); else if (!modal && dialogRef.current.open) dialogRef.current.close();}, [modal]);
  function resolve() {
    if (submitting.current || resolution) return;
    if (!choice) {setError('Choose a resolution before continuing.'); return;}
    if (!notes.trim()) {setError('Add resolution notes before resolving this issue.'); return;}
    submitting.current = true;
    const result = onResolve(shipment.id, {choice, notes, notifyRequested: notify});
    if (result.error) setError(result.error); else {setError(''); setModal('success');}
    submitting.current = false;
  }
  async function copyMessage() {
    try {await navigator.clipboard.writeText(message); setCopied(true);}
    catch {messageRef.current.focus(); messageRef.current.select(); setCopied(document.execCommand('copy'));}
  }
  const close = () => setModal(null);
  return <div className="issue-content">
    <button className="inbound-secondary issue-contact" disabled={!issue} onClick={() => {setCopied(false); setModal('contact');}}>Contact Supplier</button>
    <section className="dashboard-card issue-information"><div className="issue-heading"><h2>{shipment.id}</h2><span className={`inbound-status ${resolution ? 'inbound-status-inspecting' : 'inbound-status-issue'}`}>{resolution ? 'INSPECTING' : 'ISSUE'}</span></div><dl>{[[shipment.po, shipment.supplier], ['Received', completedTime(issue?.receivedAt)], ['Inspector', issue?.inspector || 'Not recorded'], ['Dock', shipment.dock]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
    {issue ? <>
      <div className="issue-grid"><section className="dashboard-card issue-reported"><h2>Reported Issues</h2>{issue.items.map(row => <article className="issue-description" key={row.sku}><span aria-hidden="true">!</span><div><strong>{row.name} · {row.sku}</strong><small>{row.ordered} ordered · {row.received} received · {row.damaged} damaged{row.rejected ? ` · ${row.rejected} rejected` : ''}</small><p>{row.description}</p><small>Evidence: {issue.evidence.length} {issue.evidence.some(file => file.demo) ? 'demo photo placeholders' : 'files attached'}</small></div></article>)}
        <fieldset className="issue-resolutions" disabled={Boolean(resolution)}><legend>Resolution *</legend><div>{issueChoices.map(value => <label key={value.id} className={choice === value.id ? 'issue-choice selected-choice' : 'issue-choice'}><input type="radio" name="issue-resolution" value={value.id} checked={choice === value.id} onChange={() => {setChoice(value.id); setError('');}}/><span><strong>{value.title}</strong><small>{value.description}</small></span></label>)}</div></fieldset>
        <label className="issue-notes">Resolution notes<textarea aria-label="Resolution notes" maxLength={500} rows={2} value={notes} disabled={Boolean(resolution)} placeholder="Describe the decision and follow-up required..." onChange={event => {setNotes(event.target.value); setError('');}}/></label>
      </section><section className="dashboard-card issue-impact"><h2>Evidence &amp; Impact</h2><div className="issue-evidence">{issue.evidence.map(file => file.url ? <a key={file.id} href={file.url} target="_blank" rel="noreferrer">{file.name}</a> : <div key={file.id}>{file.name}<small>Demo placeholder</small></div>)}</div><h3>Inventory impact</h3><div className="issue-impact-values"><p><span>Accepted stock</span><strong>+{impact.accepted} {impact.accepted === 1 ? 'unit' : 'units'}</strong></p><p><span>{impact.label}</span><strong>+{impact.affected} {impact.affected === 1 ? 'unit' : 'units'}</strong></p></div><p className="issue-help">Planned impact for reported items; posted at Complete Receiving.</p><h3>Supplier notification</h3><label className="issue-notify"><input type="checkbox" checked={notify} disabled={Boolean(resolution)} onChange={event => setNotify(event.target.checked)}/>Notify {shipment.supplier} after resolution</label><p className="issue-help">Records a notification request in this demo.</p>{error && <p role="alert" className="field-error">{error}</p>}{resolution ? <button className="inbound-primary" onClick={() => onContinue(shipment)}>Continue Receiving</button> : <button className="inbound-primary" disabled={!choice} onClick={resolve}>Resolve Issue</button>}</section></div>
      <section className="issue-next"><strong>What happens next?</strong><p>Save the resolution, assign storage locations, then complete receiving. Damaged or restricted units stay outside available stock.</p></section>
    </> : <section className="dashboard-card issue-unavailable"><h2>Issue record unavailable</h2><p>The item-level issue details have not been provided for this sample shipment.</p></section>}
    <button className="dashboard-link issue-back" onClick={onBack}>‹ Back to Inbound</button>
    <dialog ref={dialogRef} className="issue-dialog" aria-labelledby="issue-dialog-title" onCancel={event => {event.preventDefault(); close();}}><button className="issue-close" aria-label="Close dialog" onClick={close}>×</button>
      {modal === 'success' && resolution && <><span className="issue-success-icon" aria-hidden="true"><span>✓</span></span><h2 id="issue-dialog-title">Issue Resolved</h2><p className="issue-dialog-description">{choice === 'quarantine' ? 'The damaged item is assigned to Quarantine Zone Q-02.' : choice === 'return' ? `A return record for ${shipment.supplier} is prepared.` : choice === 'restricted' ? 'The affected item is assigned to restricted stock.' : 'A replacement request is recorded; the damaged item is assigned to Q-02.'}</p><section className="issue-dialog-summary"><dl><div><dt>Resolution</dt><dd>{option?.title}</dd></div><div><dt>{choice === 'quarantine' ? 'Supplier claim' : choice === 'return' ? 'Return reference' : choice === 'restricted' ? 'Restricted stock record' : 'Replacement request'}</dt><dd className="positive-text">{resolution.reference} recorded</dd></div></dl><p>Planned: +{impact.accepted} available unit(s) · {impact.affected} affected unit(s). Inventory is posted when receiving completes.</p></section><div className="issue-dialog-actions"><button className="inbound-secondary" onClick={onBack}>Back to Inbound</button><button className="inbound-primary" onClick={() => onContinue(shipment)}>Continue Receiving</button></div><p className="issue-dialog-footer">Continue Receiving opens the saved storage allocation step.</p></>}
      {modal === 'contact' && <><h2 id="issue-dialog-title">Contact {shipment.supplier}</h2><p className="issue-dialog-description">Copy this message and send it using your supplier contact.</p><textarea ref={messageRef} aria-label="Supplier message" className="issue-message" value={message} readOnly/><div className="issue-dialog-actions"><button className="inbound-secondary" onClick={close}>Close</button><button className="inbound-primary" onClick={copyMessage}>{copied ? 'Copied!' : 'Copy Message'}</button></div></>}
    </dialog>
  </div>;
}
