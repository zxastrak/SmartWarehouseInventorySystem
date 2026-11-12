# SUSUNO Agent Rules: Mandatory Pre-Coding Docs Check & Audit Procedure

## 1. Pre-Coding & Pre-Design Requirement
Before writing any code or proposing/implementing any UI design:
- ALWAYS view/read the route files first: `docs/routes.md` and `docs/routing.md`.
  - Check existing routes, endpoints, guards, and component hierarchies.
  - Never invent new routes or rewrite existing functional flows without verifying `docs/routes.md`.
- ALWAYS view/read the design system: `docs/design.md`.
  - Follow the SUSUNO design tokens (Olive `#5c732b`, Forest `#3e5510`, Ink `#191d17`, Canvas `#f8f9f5`).
  - Follow component standards: `.inbound-primary`, `.inbound-secondary`, `.barcode-badge-item` (`║▌║ SKU-001`), `.dashboard-card`, and semantic badges (Success/Mint, Inspecting/Cyan, Waiting/Amber, Issue/Rose).

## 2. Audit Command Procedure
When the user requests an "audit":
- Immediately navigate/login to the Audit Trail module (`/audit-trail` on Web, `/api/audit-logs` on Backend).
- Strictly follow `docs/audit.md`:
  - Open only the specific files mapped in `docs/routes.md` for the feature being audited.
  - Report findings with format `file:line` -> issue -> fix.
  - Do NOT modify code during an audit until findings are reviewed and approved.

## 3. Inbound Separation of Roles
- Web (Manager): 100% Read-Only during dock inspection. Manager cannot input quantities or add products. Manager only reads staff submission and clicks "ACC & Selesaikan Penerimaan".
- Mobile (Staff): Inspect items appears automatically on Home when shipment is "Arrived". Staff inputs actual quantities, scans physical barcodes, and submits inspection.
- No rack assignment at inbound receiving (no-rack staging).
