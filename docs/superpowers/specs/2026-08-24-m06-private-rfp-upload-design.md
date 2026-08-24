# M06 Private RFP Upload Design

## Purpose

M06 adds the first private original-document flow: an authorized project user uploads one synthetic RFP original, GOV Project OS stores it privately, records immutable metadata and a server-computed SHA-256, and authorized project members can retrieve it. Parsing, extraction, AI interpretation, Requirement Baseline creation, and any later lifecycle behavior remain out of scope for this milestone.

The full lifecycle remains unchanged. This slice establishes the original-document and storage boundary that M07 and later document flows will reuse.

## Scope

- A private Supabase Storage bucket named `rfp-originals`, created by migration.
- A project-scoped `documents` metadata table for RFP originals.
- Required privacy classification: `PUBLIC`, `INTERNAL`, `PERSONAL`, `SENSITIVE`, or `RESTRICTED`.
- Server-computed SHA-256, original filename, media type, byte size, generated storage path, actor, and timestamps.
- An immutable `RFP_ORIGINAL_UPLOADED` audit event created from the inserted document row.
- Storage and metadata RLS for tenant/project isolation.
- A Supabase-backed `StorageProvider` implementation; no second provider.
- A keyboard-operable upload form, textual success/error status, document list, and authorized download.

Out of scope for M06: parsing, OCR, SourceSpan creation, AI calls, requirement extraction, public URLs, signed-link sharing, resumable upload, document replacement/deletion UI, malware execution or preview, service-role application endpoints, and additional infrastructure.

## Considered Approaches

### 1. Server-side upload through the authenticated user session — selected

A project route handler authenticates the request, validates the file and classification, computes SHA-256 with Web Crypto, and calls Supabase Storage and the Data API with the user's SSR session. PostgreSQL and Storage RLS remain the final authorization boundary, while no permanent storage URL or privileged key reaches the browser.

This milestone limits each original to 6 MiB. The limit matches Supabase's recommended standard-upload range and stays below the current middleware buffer limit. Larger-file/resumable behavior can be added behind the same `StorageProvider` boundary after a measured need without changing the document model or reducing final product scope.

### 2. Direct browser upload — rejected for this slice

Direct authenticated uploads can scale well, but a browser-computed SHA-256 is not authoritative. Registering the uploaded object would require a second server verification/download step and a more complex partial-upload protocol.

### 3. Service-role server upload — rejected

The service role would bypass the RLS behavior M06 must prove. The public Supabase URL and publishable key plus the user's session are sufficient, so no production service credential is introduced.

## Data Model

`privacy_classification` is a PostgreSQL enum with the five master-spec values.

`documents` contains:

- `id`, `tenant_id`, and required `project_id`.
- `document_kind`, constrained to `RFP` in M06.
- `privacy_classification` with no implicit default.
- `original_filename`, `media_type`, and positive `byte_size` no greater than 6 MiB.
- `storage_bucket`, fixed to `rfp-originals`.
- `storage_path`, constrained to `<project_id>/<document_id>/original` and unique with the bucket.
- required lowercase 64-hex `sha256`.
- `created_by` and `created_at`.

Authenticated users receive `SELECT` and `INSERT` only. No authenticated `UPDATE` or `DELETE` grant or policy exists. An original therefore cannot be replaced or have its evidence fields rewritten. Project/tenant deletion is restricted while documents exist; later retention and closeout policy must make any destructive lifecycle decision explicit.

`audit_events` records the tenant, project, actor, event type, entity type and ID, timestamp, and non-sensitive event details. A narrowly scoped trigger function derives `RFP_ORIGINAL_UPLOADED` from `NEW` and inserts it in the same database transaction as document metadata. Authenticated users cannot insert, update, or delete audit rows directly.

The original file remains separate from all later AI interpretation. M06 creates no interpreted text or HUMAN_VERIFIED fact, so it creates no SourceSpan yet.

## Object Keys and Storage Boundary

Every original uses the generated key:

```text
<project_id>/<document_id>/original
```

User filenames never become object paths. This removes path traversal and normalization ambiguity while preserving the original filename only as untrusted metadata for display and download naming.

`StorageProvider` exposes only the M06 operations needed by server code: upload without upsert, authenticated download, and compensation removal of an unregistered object. `SupabasePrivateStorageProvider` is the only implementation.

## Authorization Matrix

| Role | Read metadata/original | Upload RFP original | Replace/delete successful original |
|---|---:|---:|---:|
| VIEWER | Yes | No | No |
| REVIEWER | Yes | No | No |
| EDITOR | Yes | Yes | No |
| PROJECT_ADMIN | Yes | Yes | No |
| TENANT_ADMIN | Yes, within tenant | Yes, within tenant | No |
| Anonymous / other project user | No | No | No |

`documents` policies use project membership or tenant administration. Insert additionally requires a writer role, `created_by = auth.uid()`, and a tenant/project pair that exists.

`storage.objects` policies are bucket- and operation-specific:

- `INSERT` requires an authenticated writer for the project encoded in the first path segment, a valid generated path shape, and object ownership by the current user.
- `SELECT` permits authenticated object retrieval only when a matching visible `documents` row exists. Storage listing is not granted; the UI lists `documents` through Data API RLS.
- No `UPDATE` policy exists, so `upsert: true` and object replacement fail.
- `DELETE` is limited to an object owned by the current user for which no document metadata row exists. This is compensation for a failed metadata insert and cannot remove a successfully registered original.

`anon` receives no document-table privilege and no Storage policy.

## Upload and Retrieval Flow

1. `POST /projects/<projectId>/rfp` verifies the session inside the route handler.
2. It accepts one supported RFP extension (`pdf`, `hwp`, `hwpx`, `docx`, `xlsx`, or `txt`), rejects empty or over-limit files, and requires an explicit privacy classification.
3. It reads the bytes once, computes SHA-256 server-side, generates the document ID and storage path, and confirms the visible project/tenant pair.
4. It uploads through the authenticated Supabase provider with `upsert: false`.
5. It inserts immutable document metadata. The database trigger records the audit event atomically.
6. If metadata insertion fails, it attempts the narrowly authorized orphan removal. An orphan without metadata is never readable under the Storage `SELECT` policy.
7. The route redirects to a fixed project RFP URL with a fixed success/error code. The page renders the result as text.

`GET /projects/<projectId>/documents/<documentId>/download` re-verifies the session, selects the exact document through RLS, downloads it from the private bucket through the same user session, and returns `Cache-Control: private, no-store` plus a sanitized content-disposition filename. Missing or unauthorized records return 404 without disclosing whether another project owns the document.

## Validation and Untrusted Input

- Only synthetic files are committed or created by tests.
- File bytes, filename, extension, and media type remain untrusted; M06 stores but never executes, renders, parses, or sends them to AI.
- Extension and size validation reduce accidental unsupported input but do not claim content authenticity. M07's parser boundary performs format-specific handling.
- Browser code receives no OpenAI or service-role key.
- Error/status values are fixed codes; raw database, storage, account, path, and credential errors are not reflected to users.

## Accessibility

The project page links to the RFP workflow. The upload screen uses semantic headings, a labelled file input, a labelled classification select, visible focus, a keyboard-operable submit button, format/size help connected with `aria-describedby`, and text success/error status. The document list uses real links for downloads and does not communicate state by color alone.

## Test Strategy

1. A pgTAP schema contract fails while the enum, tables, constraints, grants, private bucket, trigger, and Storage policies are absent.
2. pgTAP behavior fails before document policies and then proves required `project_id` and SHA-256, writer insert, viewer/reviewer insert denial, assigned read, cross-project zero rows, anonymous denial, immutable metadata, and an audit event.
3. A real Storage/API/browser test uploads a synthetic file through the UI, verifies exact server SHA-256 and textual status, downloads identical bytes as the assigned user, and proves anonymous and other-project downloads fail.
4. The same test attempts both normal duplicate upload and `upsert: true` against the successful object path and proves the original bytes and metadata SHA remain unchanged.
5. Axe and keyboard checks cover the upload/list/download screen.
6. Fresh typecheck, lint, unit, Eval, database reset/RLS/advisors, E2E, accessibility, dependency/secret scans, Next build, and Linux Workers preview provide the M06 Gate evidence.
