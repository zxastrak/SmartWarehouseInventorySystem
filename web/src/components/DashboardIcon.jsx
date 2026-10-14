import React from 'react';

const paths = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  box: <><path d="m12 2 10 5v10l-10 5-10-5V7Z" /><path d="m2 7 10 5 10-5M12 12v10M7 4.5l10 5" /></>,
  inbound: <><path d="M3 6V4a2 2 0 0 1 2-2h4l3 4h8a2 2 0 0 1 2 2v12H3v-4M2 11h10m-4-4 4 4-4 4" /></>,
  outbound: <><path d="M3 6V4a2 2 0 0 1 2-2h4l3 4h8a2 2 0 0 1 2 2v12H3v-4M12 11H2m4-4-4 4 4 4" /></>,
  chart: <><path d="M5 20v-5M10 20V9M15 20V3M20 20V7" /></>,
  file: <><path d="M5 2h9l6 6v14H5ZM14 2v6h6M8 12h8M8 17h5" /></>,
  users: <><circle cx="12" cy="8" r="3" /><path d="M5 21v-2a7 7 0 0 1 14 0v2M4 4a3 3 0 0 0 0 6M20 4a3 3 0 0 1 0 6M2 17a5 5 0 0 1 3-4M22 17a5 5 0 0 0-3-4" /></>,
  report: <><path d="M5 2h9l6 6v14H5ZM14 2v6h6M8 18v-4M12 18V9M16 18v-6" /></>,
  history: <><path d="M3 8a9 9 0 1 1-1 7M3 3v5h5M12 7v5l4 2" /></>,
  settings: <><path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 3-1 2 3 3-1 1-3 3-1 2-3-2-2 1-3-3-2-3 1-2-3Z" /><circle cx="12" cy="11" r="3" /></>,
  pin: <><path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 1 1 14 0Z" /><circle cx="12" cy="9" r="2" /></>,
  search: <><circle cx="10" cy="10" r="7" /><path d="m15 15 6 6" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9M10 21h4" /></>,
  warning: <><path d="m12 2 11 20H1ZM12 9v5M12 18h.01" /></>,
  close: <><circle cx="12" cy="12" r="10" /><path d="m8 8 8 8M16 8l-8 8" /></>,
  refresh: <><path d="M21 9a9 9 0 0 0-16-4L2 9m0-6v6h6M3 15a9 9 0 0 0 16 4l3-4m0 6v-6h-6" /></>,
  transfer: <><path d="M2 6h19m-5-5 5 5-5 5M22 18H3m5-5-5 5 5 5" /></>,
  arrow: <><path d="M3 12h18m-6-6 6 6-6 6" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
  menu: <path d="M3 5h18M3 12h18M3 19h18" />,
};
export default function DashboardIcon({ name, size = 24, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.box}</svg>;
}