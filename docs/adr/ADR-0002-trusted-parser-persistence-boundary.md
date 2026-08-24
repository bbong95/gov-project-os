# ADR-0002: Trusted parser persistence boundary (Draft)

- Status: Accepted
- Approved: 2026-08-25 by explicit user approval in this task
- Date: 2026-08-25
- Milestone: M07 Parser / SourceSpan

## Problem

The approved M07 design lets an authenticated project writer execute
`public.persist_document_parse(...)`. The function checks membership, document scope,
source metadata SHA-256, payload limits, and canonical result hashes, but every derived
span and both text representations still come from the caller.

A normal `EDITOR` can therefore bypass the intended server route and call the Supabase
Data API RPC directly. The database cannot distinguish that call from the Next.js route
because both use the same user JWT. A caller can calculate a self-consistent result hash
for invented text and persist it as immutable SourceSpan evidence for an existing
document.

This breaks the intended trust boundary:

```text
private immutable original bytes
→ server-side integrity check
→ trusted DocumentParser
→ immutable SourceSpan
```

## Measured evidence

- Task 5 real-role pgTAP and regression suite: 196/196 PASS after remediation.
- Supabase security and performance advisors: no issues.
- Codex Security diff scan `23a8f8f3-2da1-4af3-b48a-f1aa7d5c1557`:
  one validated Medium finding, complete coverage.
- A rollback-only local PoC used the real `authenticated` database role with an
  `EDITOR` claim. The public RPC returned a parse UUID and RLS read back caller-chosen
  SourceSpan text without any Storage download or trusted parser invocation.

The passing authorization tests prove scope isolation; they do not prove provenance of
the submitted derived evidence.

## Decision

Use a Supabase server secret only inside the server parse route for the final
persistence call. Prefer a hosted `sb_secret_...` key when available; the local Supabase
CLI can continue to use its legacy `service_role` key. Both authorize the PostgreSQL
`service_role` role, so the database grant remains the same.

1. Revoke `persist_document_parse(...)` execution from `authenticated` and `anon`.
2. Grant execution only to `service_role`.
3. Pass the initiating user ID as an explicit function argument after the route verifies
   the signed-in user.
4. Keep the function's explicit actor membership, tenant, project, document, source SHA,
   payload, idempotency, and audit checks. Do not rely on service-role bypass behavior.
5. Store the initiating user as `created_by` and `actor_user_id`; never attribute the
   action to the service credential.
6. Create a separate privileged Supabase client in a server-only module. Use a server
   secret environment variable, never a `NEXT_PUBLIC_*` variable, browser bundle, log,
   or client component. Disable session persistence, token refresh, and URL session
   detection so a user session cannot replace the privileged authorization header.
7. The route must authenticate the user, select the document through the user's RLS
   client, download the private original, recompute its exact-byte SHA-256, parse it, and
   only then call the privileged persistence RPC.

This introduces no new infrastructure. The user approved this application trust-boundary
amendment on 2026-08-25 before production behavior changed.

## Official platform constraints

Supabase maps a signed-in request to the `authenticated` PostgreSQL role, and
`auth.uid()` identifies the JWT subject. Inference from that documented authorization
model: when a browser and a Next.js route forward the same user JWT, the database has no
trusted signal that distinguishes those callers. Therefore an authenticated-only RPC
grant can enforce actor and row scope, but it cannot prove that trusted parser code
produced the payload.

Supabase documents secret keys as backend-only credentials that authorize the
`service_role` PostgreSQL role and bypass RLS. It recommends the newer
`sb_secret_...` format over the legacy JWT-based `service_role` key where available.
The key must remain server-side.

The privileged client must be separate from the SSR/user client. Supabase warns that a
user session can replace the default privileged authorization header, and its
server-side example disables `persistSession`, `autoRefreshToken`, and
`detectSessionInUrl`.

Sources:

- [Row Level Security - authenticated roles and backend secret keys](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Understanding API keys - publishable, secret, anon, and service_role](https://supabase.com/docs/guides/getting-started/api-keys)
- [Server-side administration with a secret key](https://supabase.com/docs/guides/troubleshooting/performing-administration-tasks-on-the-server-side-with-the-servicerole-secret-BYM4Fa)
- [Why an SSR service-role client can unexpectedly use the user's RLS context](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z)

## Required RED tests before production change

- An authenticated `EDITOR` direct RPC call is denied.
- A trusted server persistence call succeeds only when the supplied initiating actor is
  a writer in the exact document scope.
- A service-role call cannot spoof an unauthorized or cross-project actor.
- Viewer, reviewer, anonymous, and other-project cases remain denied.
- The trusted path records the initiating actor, not the service role, in the snapshot
  and the single `DOCUMENT_PARSED` audit event.
- Original-byte integrity failure stops before persistence.
- No service-role value appears in browser code or committed files.

## Alternatives considered

### Keep authenticated RPC and label spans as untrusted drafts

Rejected. It weakens the SourceSpan provenance contract and permits later factual
workflows to mistake caller-authored text for extracted evidence.

### Server-generated HMAC or asymmetric attestation

Not selected now. It adds database/server secret provisioning, rotation, canonical
message design, and operational complexity without a measured need beyond separating
the existing server path from browser callers.

### Dedicated database role or direct PostgreSQL connection

Not selected now. It adds credential and connection infrastructure beyond the current
Supabase/Cloudflare baseline.

## Consequences

- The service-role secret becomes a server runtime secret for one narrow M07 persistence
  path and must receive explicit secret/bundle tests.
- Compromise of that server secret remains high impact, so the privileged module must be
  minimal and never imported by browser-reachable modules.
- Existing RLS continues to protect reads; the definer function still performs explicit
  write authorization for the initiating actor.
- The original M07 statement “No service-role application endpoint is introduced” is
  superseded by this narrowly scoped, server-only persistence boundary.

## Rollback

A forward migration can revoke service-role execution and remove the privileged server
module, but authenticated execution must not be restored without a different
trusted-parser attestation design and equivalent provenance tests.
