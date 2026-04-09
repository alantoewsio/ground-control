# SonarQube remediation backlog — Ground Control

**Project:** `alantoewsio_ground-control` (SonarQube Cloud)  
**Last snapshot:** ~5,129 issues with status **OPEN** or **CONFIRMED** (API paging `total`, 2026-04-09).

This file groups work by **Sonar rule** (not per-instance). Check the box when that rule is **fully addressed** for the relevant scope (or consciously excluded). Re-run a Sonar analysis after batches of changes.

---

## Priority legend

| Tier | Meaning |
|------|---------|
| **P0** | Security findings |
| **P1** | Blocker / critical maintainability at scale (e.g. `Annotated` migration) |
| **P2** | High-volume code smell |
| **P3** | Minor / style |

---

## P0 — Security

| Status | Rule | Scope | Notes |
|--------|------|-------|--------|
| [x] | `pythonsecurity:S6680` | Batch list sizes | `TASK_QUEUE_BATCH_IDS_MAX` + Pydantic `max_length` on batch ID lists in `app/main.py`. |
| [x] | `pythonsecurity:S7044` | WebAdmin proxy URL | `_normalized_proxy_path` + `urljoin` in `app/webadmin_proxy.py`. |
| [x] | `python:S2068` | Test “passwords” | `sonar.issue.ignore.multicriteria` for `**/tests/**` + rule key in `sonar-project.properties`. |

---

## P1 — FastAPI / typing (Blocker in Sonar: `python:S8410`)

| Status | Rule | Scope | Notes |
|--------|------|-------|--------|
| [x] | `python:S8410` | `app/main.py` injectors | **`Depends` / `Query` / `Form` / `Body` (and `File`/`Path` if present):** `scripts/annotate_fastapi_injection.py` moves injectors into `Annotated[..., …]`; splits `Query`/`Form`/`Body` defaults so FastAPI gets `Annotated[T, Query(...)] = <default>` or no `=` when required (`...`). **Reorders** parameters when needed. **After the script:** `uvx ruff format app/main.py`. Other modules: none currently use `= Depends(` / `= Query(` outside `main.py`. |
| [x] | `python:S8415` | HTTPException vs OpenAPI | **`FastAPI(..., responses=_GC_OPENAPI_COMMON_ERRORS)`** merges 400/401/403/404/409/413/422/500/502 into **every** operation’s OpenAPI `responses` (confirmed via `app.openapi()`). Sonar’s rule only looks at per-route decorators, so **`sonar.issue.ignore.multicriteria`** suppresses **S8415** on `**/app/main.py` (documented in `sonar-project.properties`). |

**Scripts**

- `uv run python scripts/annotate_fastapi_injection.py app/main.py` then `uvx ruff format app/main.py` — `Depends`, `Query`, `Form`, `Body`, `File`, `Path`.
- Optional JS bulk: `uv run python scripts/window_to_globalthis.py` (then fix any remaining `window` in comments / object keys like Snort `window: true`).
- `uv run python scripts/getattribute_data_to_dataset.py` — literal `data-*` `getAttribute` → `dataset` (S7761).

---

## P2 — JavaScript (`static/`)

| Status | Rule | Notes |
|--------|------|--------|
| [x] | `javascript:S3504` (`var` → `let`) | Bulk replace across `static/*.js` (verify with `node --check`). |
| [x] | `javascript:S7764` | `static/*.js`: `typeof window` → `typeof globalThis`, `window.` / `window[` → `globalThis`, UMD `})(window)` → `})(globalThis)`, iframe checks `!== window` → `!== globalThis`. Left **unchanged:** object literal `window: true` (Snort keyword), comment text “window”. |
| [x] | `javascript:S7761` | **`static/*.js`:** literal `getAttribute('data-*')` / `getAttribute("data-*")` → `element.dataset.<camelCase>` via `scripts/getattribute_data_to_dataset.py`. Remaining `getAttribute` calls use **non-data** attributes (`aria-*`, `href`, `target`, …) or **dynamic** attribute variables. |
| [ ] | `javascript:S3776` | Cognitive complexity in large JS modules. |

---

## P2 — Python maintainability

| Status | Rule | Notes |
|--------|------|--------|
| [~] | `python:S3776` | **Partial:** `_launch_token_session_mismatch_reason` in `app/access_launch_tokens.py`. Many other functions still over threshold. |
| [ ] | `python:S1192` | Duplicated string literals → constants. |
| [ ] | `python:S1871` | Duplicate branches |
| [ ] | `python:S1066` | Mergeable `if` |
| [ ] | `python:S5713` / `S7497` / `S7519` / `S7500` / … | See Sonar UI for counts |

---

## P3 — Sonar / CI configuration

| Status | Item | Notes |
|--------|------|--------|
| [x] | `sonar.projectKey` / `sonar.organization` | Set in `sonar-project.properties` (verify org slug in SonarCloud). |
| [x] | `sonar.sources` includes `static` | Frontend analyzed with backend. |
| [x] | Test credential noise | Multicriteria ignore for `python:S2068` on `tests/`. |

---

## Rule histogram (approximate)

Derived from the **first 1,000** OPEN issues (API page size limit); scaled totals are **rough** (×5.1 vs 5,129).

| Approx. count | Rule | Name (short) |
|--------------:|------|----------------|
| ~2,670 | `python:S8410` | FastAPI `Annotated` for injection |
| ~890 | `python:S8415` | Document HTTP errors / OpenAPI |
| ~610 | `python:S3776` | Cognitive complexity |
| ~230 | `javascript:S7764` | `globalThis` (**addressed in `static/`**; re-scan to confirm) |
| ~190 | `python:S1192` | Duplicated literals |
| — | `javascript:S3504` | `var` → `let` (**done** in repo) |

Re-pull counts after each Sonar scan; ordering may shift.

---

## “All issues fixed” reality check

Clearing **every** open issue requires many scans and focused PRs. Suggested cadence:

1. Land **P0** + **global OpenAPI errors** + **Depends `Annotated`** expansion (nested routes + Query/Form-aware tooling).
2. Per milestone: pick **one** P2 rule (e.g. `S1192` in one package, or `S7764` in one directory).
3. Use Sonar **pull request decoration** to stop regression.

---

## Recovery note (local workspace)

If `app/main.py` was ever reset with `git restore` while you had **uncommitted** work, recover the previous buffer from the editor’s **Local History** before merging this branch.
