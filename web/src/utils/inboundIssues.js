import {issueChoices} from '../data/inboundIssues.js';
import {newReceivingDraft} from '../data/receiving.js';
import {acceptedUnits} from './receiving.js';

export function issueImpact(shipment, choice) {
  const rows = shipment.issue?.items || [];
  const accepted = rows.reduce((sum, row) => sum + acceptedUnits(row), 0);
  const affected = rows.reduce((sum, row) => sum + Number(row.damaged) + Number(row.rejected), 0);
  return {accepted, affected, label: issueChoices.find(value => value.id === choice)?.stock || 'Pending resolution'};
}

export function resolveInboundIssue({shipment, choice, notes, notifyRequested, inventory, racks, existingDraft, user, date}) {
  const option = issueChoices.find(value => value.id === choice);
  if (!shipment || shipment.status !== 'Issue' || shipment.issueResolution) return {error: 'This issue is already resolved or is not available for review.'};
  if (!shipment.issue?.items.length) return {error: 'An item-level issue record is not available for this sample shipment.'};
  if (!option) return {error: 'Choose a resolution before continuing.'};
  if (!notes.trim()) return {error: 'Add resolution notes before resolving this issue.'};
  const draft = existingDraft || newReceivingDraft(shipment, inventory, racks);
  const issueRows = new Map(shipment.issue.items.map(row => [row.sku, row]));
  const rows = draft.rows.map(row => issueRows.has(row.sku) ? {...row, ...issueRows.get(row.sku)} : {...row});
  const resolution = {choice, title: option.title, notes: notes.trim(), notifyRequested: Boolean(notifyRequested), notificationStatus: notifyRequested ? 'Requested (demo)' : 'Not requested', reference: `${option.reference}-${shipment.id.slice(4)}-01`, recordedAt: date, user};
  const savedDraft = {...draft, stage: 'storage', rows, notes: [shipment.issue.items.map(row => `${row.name}: ${row.description}`).join('\n'), `${option.title}: ${notes.trim()}`].join('\n'), evidence: [...(draft.evidence || []), ...shipment.issue.evidence.filter(file => !(draft.evidence || []).some(existing => existing.id === file.id))], savedAt: date};
  return {shipment: {...shipment, status: 'Inspecting', issueResolution: resolution}, draft: savedDraft};
}
