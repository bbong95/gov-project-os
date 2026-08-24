# Kordoc 4.9.1 Cloudflare Workers Compatibility Evidence

Date: 2026-08-24 18:25 KST
Milestone: M07 Parser / SourceSpan
Decision: **No Kordoc binary format is enabled in production.**

## Scope and pass contract

This spike tested the exact public `kordoc` package entry point with buffer input and both OCR paths disabled. A format can be enabled only when all of these pass:

1. exact package installation and dependency audit;
2. Node import and deterministic synthetic parse;
3. Wrangler deployment bundle for the production compatibility date;
4. actual local Workers runtime parse;
5. non-empty text, correct detected type, and only source locations the parser really exposes.

Import-only or Node-only success is not a Workers compatibility result. The only allowed outcomes are `PASS`, `FAIL_BUILD`, `FAIL_RUNTIME`, `FAIL_CONTRACT`, and `NOT_RUN_NO_SYNTHETIC_FIXTURE`.

## Environment

| Item | Exact value |
| --- | --- |
| OS | Windows, local disposable spike |
| Node.js | 24.19.0 |
| pnpm | 11.19.0 |
| kordoc | 4.9.1 |
| jszip | 3.10.1 |
| Wrangler | 4.125.0 |
| workerd | 1.20260820.1 |
| compatibility date | 2026-08-20 |
| compatibility flags | `global_fetch_strictly_public` (matches production) |
| input mode | `ArrayBuffer` only |
| OCR | `ocr: false`, `formulaOcr: false` |

Cloudflare's current Node compatibility documentation says compatibility dates on or after 2026-08-04 enable the Node compatibility layers by date, so this matching-production probe did not add an explicit `nodejs_compat` flag. The generated binding/runtime types succeeded and contained no application bindings.

## Disposable installation evidence

The scratch package lived only under ignored `temp/m07-kordoc-spike`; root `package.json` and `pnpm-lock.yaml` had zero diff.

- Initial `pnpm install --ignore-workspace`: exit 1 because pnpm refused unapproved build scripts for `onnxruntime-node` (two resolved versions), `protobufjs`, and `sharp`.
- Parser-only retry `pnpm install --ignore-workspace --ignore-scripts`: exit 0.
- Installed scratch `node_modules` footprint: 766.11 MiB.
- `kordoc` declares Node `>=18`, seven core dependencies, and five optional dependencies including `onnxruntime-node`, `sharp`, PDFium, Transformers, and PDF.js.
- The published root entry statically imports `fs/promises`; bundled code also imports `child_process`, `os`, and additional filesystem APIs. Cloudflare exposes `child_process` only as a non-functional compatibility stub.

### Dependency audit

Command: `pnpm --ignore-workspace audit --prod --audit-level high`
Exit: 1
Result: 2 High vulnerabilities.

| Advisory | Dependency path | Reported safe version |
| --- | --- | --- |
| GHSA-xcpc-8h2w-3j85 | `kordoc > onnxruntime-node > adm-zip` and Transformers path | `adm-zip >= 0.6.0` |
| GHSA-f88m-g3jw-g9cj | `kordoc > @huggingface/transformers > sharp` | `sharp >= 0.35.0` |

This is independently release-blocking under the project's High-vulnerability rule; no exception was requested or created.

## Synthetic fixture evidence

All fixtures were generated locally from explicit synthetic strings. No Kordoc corpus, public-sector document, customer document, template, or transcript was copied.

| Fixture | Bytes | SHA-256 for this run | Node parse observation |
| --- | ---: | --- | --- |
| HWPX | 28,287 | `8494fb989ccaa4522e73db7984549f200ceca9d6e70b0062b5ffb5db8a3c1a69` | `hwpx`, 3 blocks, 70 text chars, section-approximate page 1, no warnings |
| PDF | 608 | `684cf1d2e9a16092acb7bbd476d74032fbafc4d11d4591edd477a79e096e01ba` | `pdf`, 1 block, 33 text chars, layout page 1, no warnings |
| XLSX | 2,300 | `d3b7e4a04fc8b79c8575886109e95df3df2df10f6b8456f3a3164295e94d5d17` | `xlsx`, 2 blocks, 92 text chars, sheet projection 1, no warnings |
| DOCX | 1,154 | `b5528a2aa4caa86348284d666fe847bfb610a9af15123ce5935ea371b8cd9b9a` | `docx`, 2 blocks, 66 text chars, no page claim, no warnings |

The Node import/generation/parse probe exited 0 for all four fixtures. These observations confirm the fixture and library contract only; they do not override the Workers gate.

HWP was not tested because the package produces HWPX but no clearly synthetic HWP fixture was available. Its outcome is therefore `NOT_RUN_NO_SYNTHETIC_FIXTURE` rather than an inferred result.

## Workers build and runtime evidence

Fresh isolated command:

```text
pnpm exec wrangler deploy --config temp/m07-kordoc-spike/wrangler.jsonc --dry-run --outdir temp/m07-kordoc-spike/dist-exact
```

Exit: 1 (`FAIL_BUILD`).
Bundle size: not available; Wrangler produced no Worker bundle. Its output directory contained only a 125-byte diagnostic README.

Sanitized failure excerpt:

```text
Build failed with 5 errors: No loader is configured for ".node" files from onnxruntime-node ... onnxruntime_binding.node
```

The five failures cover native bindings for Darwin, Linux, and Windows architectures. Because a deployable bundle did not exist, starting `wrangler dev` would not be an actual runtime probe. Runtime was deliberately not misreported as tested.

## Per-format decision matrix

| Format | Node contract | Workers bundle | Workers runtime | Location precision seen in Node | Final outcome |
| --- | --- | --- | --- | --- | --- |
| HWPX | pass | fail | not run: no bundle | section approximate | `FAIL_BUILD` |
| PDF | pass | fail | not run: no bundle | layout page | `FAIL_BUILD` |
| XLSX | pass | fail | not run: no bundle | sheet projection | `FAIL_BUILD` |
| DOCX | pass | fail | not run: no bundle | none claimed | `FAIL_BUILD` |
| HWP | not run | not run | not run | unknown | `NOT_RUN_NO_SYNTHETIC_FIXTURE` |

## Production allowlist

Kordoc-backed MIME types allowed into M07 production: **none**.

The only production parser in M07 remains the in-repository strict UTF-8 `text/plain` parser. Binary MIME types remain unsupported and must receive a fixed unsupported-format result. No Kordoc production dependency, external parser process, parser service, new infrastructure, OCR/model download, or AI call is authorized by this report.

The unaccepted runtime-boundary analysis is recorded in `docs/adr/ADR-0001-parser-runtime-boundary-draft.md`.

## Reproduction notes

- The entire probe directory is disposable and must be removed after this report is committed.
- Re-run only with explicitly synthetic inputs.
- Re-test the exact package if Kordoc publishes a Workers/parser-core export that excludes filesystem, COM/subprocess, OCR, and native optional dependency paths.
- Official runtime references checked on 2026-08-24:
  - https://developers.cloudflare.com/workers/runtime-apis/nodejs/
  - https://developers.cloudflare.com/workers/best-practices/workers-best-practices/
  - https://developers.cloudflare.com/workers/wrangler/bundling/
