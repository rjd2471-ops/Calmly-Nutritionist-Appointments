# Calmly Test & Verification Report

## Verification Methodology
All pure unit and domain invariant tests were executed via the internal test suite located at `src/lib/tests/pureTests.ts`, which runs identically in Node/Vitest and in the browser at `/tests`.

---

## 1. Automated Pure Tests Run & Results

| # | Test Case Description | Category | Actually Run? | Result | Notes |
|---|---|---|:---:|:---:|---|
| 1 | `date-formats`: Handles DD/MM/YYYY, D/M/YYYY, DD-MM-YYYY, YYYY-MM-DD | Normalizers | Yes | PASSED | Verified day-first ordering |
| 2 | `date-impossible`: Rejects 31/02/2026, 29/02/2025; accepts leap year 29/02/2024 | Normalizers | Yes | PASSED | Checked month day boundaries |
| 3 | `time-formats`: Handles 10:00, 14:00, 11:30am, 4 pm, 4PM, 4:30 pm | Normalizers | Yes | PASSED | Standardizes to 24h HH:mm |
| 4 | `time-12am-12pm`: Handles 12 am (00:00) and 12 pm (12:00) | Normalizers | Yes | PASSED | Prevents noon/midnight inversion |
| 5 | `phone-normalization`: Cleans +91, spaces, dashes, leading 0; validates 10 digits starting 6–9 | Normalizers | Yes | PASSED | Rejects <10 digits, >10 digits, and non 6–9 prefixes |
| 6 | `client-key`: Resolves Riya Shah phone variants to identical client key (`phone:9820011111`) | Normalizers | Yes | PASSED | Fallback to name for Meera Iyer |
| 7 | `slot-grid`: Generates exactly 18 slots (09:00 to 17:30, 30m grid) | Slots & IST | Yes | PASSED | Verified start, end, and 30m step |
| 8 | `past-slot-disabling`: Disables past slots against IST date and time | Slots & IST | Yes | PASSED | Past dates/times disabled |
| 9 | `two-hour-cancel-rule`: Blocks cancel/reschedule when slot is <= 2 hours away | Rules | Yes | PASSED | Enforces 2-hour window |
| 10 | `env-sanitizing-secret-refusal`: Trims prefixes/quotes, refuses `sb_secret` & `service_role` | Security | Yes | PASSED | Refuses secret keys with red error |
| 11 | `csv-formula-neutralization`: Prefixes `=`, `+`, `-`, `@` with apostrophe | Security | Yes | PASSED | Prevents spreadsheet formula injection |
| 12 | `noshow-rate-formula`: Computes $\frac{\text{No-show}}{\text{Done} + \text{No-show}}$ across non-cancelled rows | Metrics | Yes | PASSED | Accurate denominator excludes cancelled |
| 13 | `repo-double-booking-prevention`: Prevents booking the same slot twice (23505 error) | Data Access | Yes | PASSED | Verified slot frees after cancellation |
| 14 | `same-slot-reschedule-blocked`: Rescheduling to exact same slot is blocked | Rules | Yes | PASSED | User notified they already hold slot |
| 15 | `max-3-upcoming-bookings`: Prevents 4th upcoming Booked appointment per phone | Rules | Yes | PASSED | 3 allowed, 4th rejected |
| 16 | `seed-normalization-and-survival`: Sample seed items normalized; Meera has null phone, Kabir has No-show | Sample Data | Yes | PASSED | Cleaned without hardcoding |
| 17 | `seed-shift-and-reset-survival`: Statuses survive seed, shift, and reset | Sample Data | Yes | PASSED | Meera remains Done; Kabir remains No-show |

---

## 2. Browser & Visual Verification

- **Viewport & Zoom Prevention**: Tested viewport meta `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`. All inputs configured with font size $\ge 16\text{px}$ to prevent iOS Safari auto-zoom. Verified at 360px width without horizontal scrollbars.
- **Top Bar Contract**: Client header implements single-element wordmark ("Calmly"), single-line text links ("Home", "Book Consultation", "My Appointments"), and right action. No admin links in client layout.
- **Admin Isolation**: Admin console (`/admin`, `/dashboard`) contains separate dark header with live status, connection panel, and "Open client app" link. Injected with `<meta name="robots" content="noindex, nofollow">`.
- **AI Assistant**: Tested Assistant chat UI with voice input toggle (`SpeechRecognition`), text-to-speech toggle (`speechSynthesis`), Confirmation Card proposal rendering, and fallback mode.
- **Model Resolution Fix**: Resolved `GenerateContentRequest.model: unexpected model name format` by validating and sanitizing `process.env.GEMINI_MODEL`, preventing non-model tokens/keys from passing to the `@google/genai` SDK, and establishing a multi-model fallback chain (`gemini-3.1-flash-lite`, `gemini-2.5-flash`, `gemini-flash-latest`). Successfully verified live booking proposal generation via HTTP POST.

---

## 3. Explicit List of Non-Implemented Requirements
- None. All requested features from Step 1, Step 2, and Step 3—including the 2-sided application structure, normalizers, sample seed data preservation, no-show features, rule-based risk calculation, WhatsApp prefilled link generation, CSV formula sanitization, serverless Gemini assistant with function calling, and `/tests` page—have been implemented.
