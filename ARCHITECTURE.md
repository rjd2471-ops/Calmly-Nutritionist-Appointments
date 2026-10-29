# Calmly Technical Architecture

## 1. Domain-Driven Design & Layering

```
┌────────────────────────────────────────────────────────┐
│                   Presentation Layer                   │
│   Client App (/)       Admin Side (/admin)     /tests  │
└────────────────────────────────────┬───────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────┐
│                    Repository Layer                    │
│   IRepository (types.ts)                               │
│     ├── SupabaseRepo (PostgreSQL Realtime + Polling)   │
│     └── LocalStorageRepo (Resilient Browser Storage)   │
└────────────────────────────────────┬───────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────┐
│               Domain Rules & Normalization             │
│   src/lib/normalize.ts (Pure date, time, phone logic)  │
│   src/lib/ist.ts       (Asia/Kolkata timezone math)    │
└────────────────────────────────────────────────────────┘
```

## 2. Two-Sided Application Isolation
- **Client Web App (`/`, `/book`, `/appointments`)**:
  - Focuses on seamless patient appointment booking, confirmation, and reschedule.
  - Zero navigation affordances or hyperlinks to administrative routes (`/admin`, `/dashboard`, `/tests`).
- **Admin Console (`/admin`, `/dashboard`)**:
  - Distinct navigation header with live Supabase synchronization indicator.
  - Injected with `<meta name="robots" content="noindex, nofollow">` to prevent web crawlers from indexing practice data.
  - Full audit trail, no-show rate analytics, timeline, and waitlist routing.

## 3. Data Integrity & Concurrency Invariants
- **No Deletes Policy**: The appointment table enforces a strict non-deletion policy. Cancellations are modeled as status transitions (`status = 'Cancelled'`), preserving historical telemetry and audit continuity.
- **Double Booking Elimination**: Enforced at the database layer via PostgreSQL partial unique index `(date, time) WHERE status <> 'Cancelled'` and at the application layer via slot locking.
- **Optimistic Concurrency**: Administrative updates send `expected_updated_at`. If another browser modified the appointment concurrently, the update fails cleanly and triggers an automatic refetch.

## 4. AI Assistant Design & Guardrails
- **Serverless API Proxy (`/api/assistant`)**: All interactions with the `@google/genai` TypeScript SDK occur strictly on the server side (`server.ts` / `api/assistant.ts`). The `GEMINI_API_KEY` is never bundled into client assets.
- **Safety Boundary**: The assistant operates on a strict **confirm-before-book** model. The model only has access to a non-writing `propose_booking` tool. The client frontend displays an explicit Confirmation Card, and writes occur only upon physical user click.
- **Rate Limiting & Memory Window**: In-memory IP-based rate limiting (25 requests per 10 minutes) and truncation to the last 10 conversational turns with a maximum message size of 500 characters.
