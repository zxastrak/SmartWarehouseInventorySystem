export const outboundTypes = [
  {name:'Warehouse transfer', caption:'Move stock to another branch', label:'Destination warehouse', destinations:[], prefix:'TR'},
  {name:'Customer order', caption:'Fulfil a sales order', label:'Customer destination', destinations:[], prefix:'SO'},
  {name:'Internal request', caption:'Supply an internal unit', label:'Internal destination', destinations:[], prefix:'IR'},
];

export const outboundStatuses = ['Scheduled','Picking','Packing','Ready to Ship','Shipped','Issue'];

export const outboundSeed = [];

export const readyToShipDraftSeed = {};

export const packingDraftSeed = {};

export function outboundDate(date) {
  if (!date) return 'Not provided';
  const value = new Date(`${date}T00:00:00+07:00`);
  return Number.isNaN(value.getTime()) ? 'Not provided' : new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'Asia/Jakarta'}).format(value);
}
