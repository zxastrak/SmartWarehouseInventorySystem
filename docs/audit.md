## Audit Rules (`docs/audit.md`)

### Step 0: Login / Akses ke Modul Audit
Apabila pengguna memerintahkan **"audit"**:
- Segera lakukan login / akses ke modul **Audit Trail & Audit Log** (`/audit-trail` pada antarmuka Web atau API `/api/audit-logs` pada Backend).

### Step 1: Read the map first
Before auditing, read `docs/ROUTES.md` (atau `docs/routes.md`). It decides which files need to be traced.
Open only the files listed for the requested feature or route.
Pastikan juga membaca standar desain di `docs/design.md` jika audit menyangkut tampilan UI.

### Allowed
- Read the files listed in `docs/ROUTES.md` for the requested feature.
- Follow an import into a neighboring file only when the listed file needs it (say why).
- Check the Guard / Role column: confirm the guard is applied.
- Report findings as `file:line` -> issue -> fix.
- Flag when `ROUTES.md` is outdated or missing the feature, and propose an update.

### Not allowed
- Do not scan the whole repo or list every file.
- Do not trace login/auth, app bootstrap, or routes unrelated to the request.
- Do not open files that are not in `ROUTES.md` without a stated reason.
- Do not modify code during an audit. Report first, fix after approval.
- Do not invent issues. Mark anything unverified as "Unverified".

### Exception
Scan the full repo only if the user explicitly says "full audit".