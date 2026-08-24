# M05 Auth / Tenant / Project / RLS Design

## Purpose

M05 establishes the authentication and database authorization boundary used by every later GOV Project OS lifecycle object. It does not add RFP behavior or narrow the product to project administration.

## Scope

- Supabase email/password login and logout through Next.js Server Actions.
- A protected project list that reads through the Supabase Data API under the signed-in user's session.
- Tenant, project, tenant membership, and project membership schema.
- The roles `VIEWER`, `EDITOR`, `REVIEWER`, `PROJECT_ADMIN`, and `TENANT_ADMIN`.
- Database-enforced tenant and project isolation with pgTAP evidence.
- Keyboard-operable, labelled login and logout controls with textual error/status output.

Out of scope for M05: signup, invitations, password reset, MFA enrollment UI, project creation UI, RFP upload, service-role application endpoints, ABAC/ReBAC, and custom authorization infrastructure.

## Considered Approaches

### 1. Database membership rows plus RLS — selected

Authorization is derived from `tenant_memberships` and `project_memberships`. Policies use `(select auth.uid())`, explicit table grants, and indexed membership lookups. This keeps authorization current and enforces the boundary for every Data API caller.

### 2. JWT role claims — rejected

JWT claims can become stale until refresh, and user-editable metadata must never drive authorization. Adding custom access-token hooks would also expand this slice without solving a demonstrated problem.

### 3. Application-only project filters — rejected

Application filtering cannot prove the required cross-project read/write count is zero when another endpoint or client omits the filter. The database must be the final enforcement point.

## Data Model

`membership_role` is a PostgreSQL enum containing all five required roles.

- `tenants`: immutable identity, display name, creator, and creation time.
- `tenant_memberships`: one row per tenant administrator. A check constraint permits only `TENANT_ADMIN` in this table.
- `projects`: tenant-owned project identity, name, creator, and timestamps.
- `project_memberships`: one row per project member. A check constraint permits `VIEWER`, `EDITOR`, `REVIEWER`, or `PROJECT_ADMIN`, never `TENANT_ADMIN`.

`project_memberships` stores both `tenant_id` and `project_id` and uses a composite foreign key to `projects(tenant_id, id)`. This prevents a membership from pointing at a project in another tenant. Every foreign key and RLS lookup path receives an index.

## Role Matrix

| Role | Read assigned project | Update assigned project metadata | Read all tenant projects | Update all tenant projects |
|---|---:|---:|---:|---:|
| VIEWER | Yes | No | No | No |
| REVIEWER | Yes | No | No | No |
| EDITOR | Yes | Yes | No | No |
| PROJECT_ADMIN | Yes | Yes | No | No |
| TENANT_ADMIN | Yes | Yes | Yes | Yes |

M05 exposes no client-side membership mutation or tenant/project creation. Those operations remain unavailable rather than receiving speculative broad policies. Future high-risk tenant-admin mutations can add an `aal2` condition without changing the membership model.

## RLS and Grants

All four `public` tables have RLS enabled. `anon` receives no privileges. `authenticated` receives only `SELECT` on tenant and membership tables and `SELECT, UPDATE` on projects. `service_role` receives explicit privileges for trusted server/test administration and remains forbidden from browser code.

Policies are operation-specific:

- A project member can select only their assigned project rows.
- A tenant administrator can select and update project rows in their tenant.
- Only `EDITOR`, `PROJECT_ADMIN`, and `TENANT_ADMIN` can update project metadata.
- `VIEWER` and `REVIEWER` are read-only.
- An unauthenticated request cannot reach private project rows.

No `SECURITY DEFINER` function is needed in this slice. Policies use non-recursive membership lookups whose visible rows are limited to the current user's own membership or tenant-admin membership.

## Authentication Flow

`/login` renders a semantic form. Its Server Action validates string inputs and calls `signInWithPassword` using the server Supabase client. Authentication errors produce one generic Korean text message without revealing account existence. Success redirects to `/projects`.

`/projects` validates identity with `getClaims()` and redirects unauthenticated requests to `/login`. It queries `projects` through the user's Supabase session and relies on RLS for row selection. Logout calls `signOut()` in a Server Action and redirects to `/login`.

A Next.js `proxy.ts` refreshes Auth cookies using the current Supabase SSR cookie adapter and `getClaims()`. No service-role key or OpenAI key is introduced.

## Test Strategy

1. pgTAP schema contract fails while the tables are absent, then passes after the minimal schema migration.
2. pgTAP behavior tests fail while policies are absent, then pass after minimal policies are added.
3. The behavior suite proves assigned read and write, cross-project read and write denial, anonymous denial, and read-only role behavior using real PostgreSQL roles and synthetic UUID fixtures.
4. A Playwright test creates a synthetic local Auth user through a runtime-only service credential, signs in through the real form, observes only its assigned project, and signs out with the keyboard.
5. Axe checks the login and protected project screens against the configured WCAG A/AA tags.
6. Fresh typecheck, lint, unit, Eval, RLS, E2E, accessibility, dependency/secret checks, build, database advisors, reset, and Workers preview provide the M05 Gate evidence.

## Security and Privacy

- Fixtures use only synthetic `.test` identities and fictional project names.
- The local service credential is discovered at runtime, kept in memory, and never printed or committed.
- Browser bundles receive only the public Supabase URL and publishable key.
- Error messages do not disclose whether an account exists.
- No real customer material or personal data is added.
