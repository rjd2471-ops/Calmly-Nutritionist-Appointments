# Calmly Security Model & Threat Defenses

## 1. Credential Sanitization & Secret Rejection
- **Publishable Key Enforcement**: The application strictly validates keys provided via `VITE_SUPABASE_ANON_KEY`. Any key with prefixes starting with `sb_secret` or containing `service_role` is immediately rejected.
- **Accidental String Cleaning**: The sanitizer trims stray quotes and variable declarations (e.g. `VITE_SUPABASE_URL=https://...`) to prevent malformed connection strings.
- **Key Masking**: Keys are never printed in plain text anywhere in logs, connection panels, or error banners; keys are masked to 6 characters (e.g. `eyJhbG...`).

## 2. Spreadsheet Formula Injection Defense (CSV)
CSV exports sanitize all cells by checking for executable command prefixes (`=`, `+`, `-`, `@`). Cells starting with these characters are prepended with an apostrophe (`'`) to disable dynamic DDE / formula execution when opened in Microsoft Excel, LibreOffice, or Google Sheets.

## 3. Serverless Proxy & Gemini Isolation
- Gemini API interactions occur on the server side via `process.env.GEMINI_API_KEY`.
- The assistant endpoint enforces:
  - 500-character payload limits.
  - 10-turn conversation truncation.
  - IP-based rate limiting.
  - Strict tool definitions with zero database write permissions.

## 4. Known Security Limitations
- **Open Admin Route**: The practice management portal does not require authentication per client assignment specifications. Anyone holding the URL can view and manage appointments.
- **Client Identity**: Identity is bound to the device's local storage phone entry.
