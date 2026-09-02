# PROJECT AUDIT — shakran-qa-portfolio-playwright

**Audit date:** 2026-09-02
**Audited by:** Claude (Claude Code)
**Method:** every claim below was verified by reading the file or running the command. Commands actually executed are shown with their real output. Nothing here is inferred from the README alone.

**Headline:** the project installs cleanly and the code is healthy, but **the committed Guru99 test suite is broken — 4 of 6 tests fail.** The blocker is expired demo credentials in `.env`, not a code defect. See [§8 Verdict](#8-honest-current-state-verdict).

---

## 1. Project structure

Full tree, excluding `node_modules/` and `.git/`:

```
shakran-qa-portfolio-playwright/
├── .claude/
│   └── settings.local.json        # Claude Code local permissions (1 stale entry)
├── docs/
│   └── report-screenshot.png      # 112 KB screenshot of a passing report, used in README
├── pages/                         # Page Object Model classes
│   ├── .gitkeep                   # empty; leftover from when the folder was empty
│   ├── CustomerCreatePage.ts      # 88 lines
│   └── ManagerLoginPage.ts        # 56 lines
├── tests/                         # Playwright specs
│   ├── create-customer.spec.ts    # 45 lines   (committed)
│   ├── manager-login.spec.ts      # 44 lines   (committed)
│   ├── seaticket.spec.ts          # 272 lines  (UNTRACKED)
│   ├── vaani.spec.ts              # 243 lines  (UNTRACKED)
│   └── vcboom.spec.ts             # 231 lines  (UNTRACKED)
├── Results/                       # gitignored — timestamped HTML reports + screenshots
├── test-results/                  # gitignored — Playwright failure artifacts
├── playwright-report/             # gitignored — stale report from 2026-06-03
├── .env                           # gitignored — REAL credentials (all 3 vars present)
├── .env.example                   # credential template for reviewers
├── .gitignore
├── package.json                   # NOTE: "scripts" is empty — see §2
├── package-lock.json              # lockfileVersion 3, 8 packages
├── playwright.config.ts
├── README.md
└── tsconfig.json
```

**Top-level purpose notes**

| Path | Purpose |
|---|---|
| `pages/` | POM classes. Locators + action methods, no assertions. |
| `tests/` | Specs. Two committed (Guru99 demo bank), three untracked (exploratory audits of live third-party sites). |
| `docs/` | One image, referenced by README as proof of a green run. |
| `Results/` | Output dir. Holds 5 timestamped HTML reports (2026-06-03 ×3, 2026-06-26 ×2) plus `seaticket/`, `vaani/`, `vcboom/` screenshot folders. |
| `test-results/` | Playwright's per-failure artifacts (screenshot, video, trace, `error-context.md`). |
| `playwright-report/` | Default Playwright report dir. **Stale** — dated 2026-06-03, orphaned since the config was changed to write into `Results/`. |
| `.env` / `.env.example` | Credential handling. `.env` is correctly gitignored. |

**No `CLAUDE.md`, no `notes` file, no CI config (`.github/`), and no `docs/` written notes exist in this repo.** README.md is the only prose documentation.

---

## 2. Tech stack & config

### 2.1 `package.json`

```json
"scripts": {}
```

⚠️ **The `scripts` block is completely empty.** There is no `test` script. Verified:

```
$ npm test
npm error Missing script: "test"
npm error
npm error To see a list of scripts, run:
npm error   npm run
```

The README is consistent with this — it tells you to run `npx playwright test` directly — but it means there is no `npm test` / `npm run test:headed` / `npm run report` convenience layer. This is a gap worth closing (§8).

**Dependencies:** none. **devDependencies** (all 4):

| Package | Declared | Installed | Notes |
|---|---|---|---|
| `@playwright/test` | `1.60.0` | 1.60.0 | Pinned exactly (no `^`) — deliberate and good. |
| `@types/node` | `^25.9.1` | 25.9.1 | |
| `dotenv` | `^17.4.2` | 17.4.2 | Loaded in `playwright.config.ts`. |
| `typescript` | `^6.0.3` | 6.0.3 | |

Other fields: `"type": "commonjs"`, `"main": "index.js"` (there is no `index.js` — harmless boilerplate), `"license": "ISC"`, and empty `description`/`keywords`/`author`.

### 2.2 `playwright.config.ts`

| Setting | Value | Comment |
|---|---|---|
| `testDir` | `./tests` | |
| `fullyParallel` | `true` | Effectively neutralised by `workers: 1`. |
| `forbidOnly` | `!!process.env.CI` | |
| `retries` | `1` on CI, `0` locally | |
| `workers` | **`1` always** | The code comment says *"One worker on CI…; unlimited locally for speed"* but the value is a hard-coded `1` — the comment does not match the code. README §Key Implementation Notes confirms `workers: 1` was the intent (Guru99 flakiness under parallel load), so the **comment is wrong, not the value**. |
| `reporter` | `[['html', { open: 'never', outputFolder: \`Results/test-report ${timestamp}\` }]]` | Timestamp is computed once at config load. Each run gets its own folder — nothing is ever overwritten, and nothing is ever cleaned up. |
| `use.baseURL` | `process.env.GURU99_BASE_URL` | **No fallback.** If `.env` is missing, `baseURL` is `undefined`. |
| `use.screenshot` | `'on'` | Non-default — screenshot on every step, deliberately, for portfolio evidence. |
| `use.trace` | `'on'` | Non-default — full trace on *every* test. Expensive but intentional. |
| `use.video` | `'retain-on-failure'` | Code comment says *"Record video on first retry only"* — that is **not** what `retain-on-failure` does (it records always, keeps only on failure). Comment is inaccurate. |
| `projects` | `chromium`, `firefox` | WebKit deliberately dropped, with a documented rationale in the file. |
| **`timeout`** | **not set → 30 000 ms default** | See the finding below. |
| **`expect.timeout`** | **not set → 5 000 ms default** | Matches the `Timeout: 5000ms` seen in the failure output. |

🔎 **Finding — unreachable timeouts in the exploratory specs.** Because the config never sets a global `timeout`, the per-test timeout is Playwright's 30 s default. But `vaani.spec.ts` and `vcboom.spec.ts` pass `{ timeout: 60000 }` to nearly every `page.goto()` — **a 60 s navigation timeout can never be honoured inside a 30 s test.** This is not theoretical; it is exactly how the one exploratory failure in §5 happened:

```
Test timeout of 30000ms exceeded.
Error: page.goto: Test timeout of 30000ms exceeded.
```

`seaticket.spec.ts` avoids this in two of its five tests by calling `test.setTimeout(120000)`. `vaani.spec.ts` never calls it at all.

### 2.3 `tsconfig.json`

Non-default settings:

| Option | Value | Note |
|---|---|---|
| `target` | `ESNext` | |
| `module` | `commonjs` | Matches `"type": "commonjs"`. |
| `moduleResolution` | `node10` | Legacy resolution; works, but is the reason `ignoreDeprecations` below is needed. |
| `ignoreDeprecations` | `"6.0"` | **Suppressing a TypeScript 6 deprecation warning.** `node10` resolution is deprecated in TS 6 — this flag silences it rather than fixing it. A future TS release will likely remove the escape hatch. |
| `strict` | `true` | Good. |
| `esModuleInterop` | `true` | Needed for the `import dotenv from 'dotenv'` default import. |
| `types` | `["node"]` | |
| `include` | `tests/**/*.ts`, `pages/**/*.ts`, `playwright.config.ts` | |

**Typecheck result — clean:**

```
$ npx tsc --noEmit
(no output)
=== exit: 0 ===
```

---

## 3. Test coverage map

`npx playwright test --list` reports **`Total: 34 tests in 5 files`** — 17 test definitions × 2 browser projects.

| Spec file | Git status | Target under test | Feature / flow covered | Test cases | Runs × browsers |
|---|---|---|---|---|---|
| [tests/manager-login.spec.ts](tests/manager-login.spec.ts) | committed | demo.guru99.com/V4 | Manager login — valid creds redirect to dashboard; invalid creds raise a native `alert()` dialog | **2** | Chromium, Firefox → 4 |
| [tests/create-customer.spec.ts](tests/create-customer.spec.ts) | committed | demo.guru99.com/V4 | Log in → open Add Customer → fill all 10 fields → submit → assert "Customer Registered Successfully!!!" | **1** | Chromium, Firefox → 2 |
| [tests/seaticket.spec.ts](tests/seaticket.spec.ts) | **untracked** | seaticket.ai + cloud.seaticket.ai | Exploratory audit: homepage console/page errors; login validation (empty + invalid submit); 375 px mobile overflow; auth-gating of the dashboard; browser-Back mid-flow | **5** | Chromium, Firefox → 10 |
| [tests/vaani.spec.ts](tests/vaani.spec.ts) | **untracked** | vaani.media | Exploratory audit: homepage console/page errors; upload flow auth-gating; login page has no native form (Google OAuth only); 375 px mobile overflow; browser-Back mid-flow | **5** | Chromium, Firefox → 10 |
| [tests/vcboom.spec.ts](tests/vcboom.spec.ts) | **untracked** | vcboom.com | Exploratory audit: homepage console errors; Clerk signup validation (empty / invalid email / **real signup attempt**); 375 px mobile overflow; browser-Back mid-signup | **4** | Chromium, Firefox → 8 |
| | | | **TOTAL** | **17** | **34** |

### Two distinct bodies of work live in one repo

This is the single most important structural thing to re-absorb:

- **The committed project** (2 specs, 3 tests) is the *portfolio piece*: Guru99 demo bank, strict POM, `.env` credentials, cross-browser. This is what README.md describes. README's coverage table says *"3 tests × 2 browsers = 6 total"* — accurate **for the committed suite only**.
- **The untracked specs** (3 specs, 14 tests) are *exploratory QA audits of live third-party production websites*. They share nothing with the POM layer — they use inline locators, absolute URLs (each file explicitly documents that `baseURL` points at Guru99 and must be bypassed), `expect.soft()` throughout, and `console.log` + screenshots as the primary deliverable rather than pass/fail. They are structurally a different kind of artifact that happens to reuse the same Playwright runner.

**README.md documents only the first group.** Anyone cloning this repo sees 3 tests; anyone opening the working tree sees 17.

### ⚠️ Behavioural warning on `vcboom.spec.ts`

[tests/vcboom.spec.ts:157-164](tests/vcboom.spec.ts#L157-L164) — Case C of TEST 2 performs a **real account signup against a live Clerk backend**, using `shakrantestqa@protonmail.com` / `TestQA@2026`, on every run, on both browsers. Its own comment acknowledges this:

> `// NOTE: this is a real signup attempt against a live Clerk backend. It may`
> `// surface a verification step, a CAPTCHA, or an "email taken" message —`
> `// all of which are interesting outcomes we capture rather than assert on.`

**This spec was deliberately excluded from this audit's test run** (see §5.4). Running the full suite unattended will attempt account creation on a third party's production system.

---

## 4. Page Object Model

Only the **committed Guru99 suite** uses the POM. The three untracked exploratory specs bypass it entirely.

| POM class | File | Responsibility | Used by |
|---|---|---|---|
| `ManagerLoginPage` | [pages/ManagerLoginPage.ts](pages/ManagerLoginPage.ts) | Guru99 manager login form. Exposes `userIdInput`, `passwordInput`, `loginButton`, `resetButton`. Methods: `goto()`, `login(userId, password)`, `reset()`. | `manager-login.spec.ts`, `create-customer.spec.ts` |
| `CustomerCreatePage` | [pages/CustomerCreatePage.ts](pages/CustomerCreatePage.ts) | Guru99 "Add New Customer" form. Exposes 13 locators (name, gender radios, dob, address, city, state, pin, mobile, email, password, submit, reset). Methods: `goto()`, `fillForm(data)`, `submit()`. | `create-customer.spec.ts` |

### Pattern in use

- **No base page class.** Both classes are standalone; there is no shared `BasePage` and no inheritance. At two classes this is fine, but there is duplication forming — both declare `passwordInput` and a `resetButton`/`reset` concept independently.
- **Constructor-injected page, private readonly:** `constructor(private readonly page: Page)`. Consistent across both.
- **Locators are `readonly Locator` fields assigned in the constructor** — lazy, resolved at action time. Both files carry a comment explaining this choice.
- **Locator strategy: CSS attribute selectors on `name`**, e.g. `input[name="uid"]`, `input[name="btnLogin"]`, `textarea[name="addr"]`. Chosen to match Guru99's legacy HTML, which has no test IDs and no accessible roles worth targeting. Both files document the underlying markup in comments.
  - Note the inconsistency: the POMs use CSS/`name` selectors, but the specs assert with the user-facing `page.getByText(...)`. Mixed but defensible.
- **No assertions inside POMs.** Every `expect` lives in the spec. Clean separation — this is the correct discipline and it is followed without exception.
- **Navigation nuance, well handled:** `ManagerLoginPage.goto()` uses `page.goto('')` — not `'/'` — with a comment explaining that `'/'` would resolve to the domain root instead of the `/v4/` base path. `CustomerCreatePage.goto()` uses the relative `'manager/addcustomerpage.php'`.
- **Typed form data:** `fillForm()` takes an inline-typed object of 9 fields. Gender is hard-coded to Male (documented).

**Assessment:** for a two-page surface this is a textbook-clean POM. The code quality here is genuinely good and is not the source of any current failure.

---

## 5. How to run it — verified

Environment: Node **v24.14.0**, npm **11.12.1**, Playwright **1.60.0**, Windows 11.

### 5.1 Install — ✅ clean

```
$ npm install

up to date, audited 8 packages in 2s

1 package is looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

**No errors, no warnings, no vulnerabilities.** Browser binaries were already present in `%USERPROFILE%\AppData\Local\ms-playwright` (chromium-1234, firefox-1538, webkit-2336 and older revisions), so `npx playwright install` was not re-run.

### 5.2 `npm test` — ❌ does not exist

```
$ npm test
npm error Missing script: "test"
```

There is no test script. The working command is `npx playwright test`.

### 5.3 Committed Guru99 suite — ❌ **4 of 6 FAILED**

```
$ npx playwright test tests/manager-login.spec.ts tests/create-customer.spec.ts --reporter=list
```

**Duration: 1.6 m (96 s wall clock). Exit code: 1.**

| # | Browser | Test | Result | Time |
|---|---|---|---|---|
| 1 | chromium | create-customer › should create a new customer successfully | ❌ **FAIL** | 13.4 s |
| 2 | chromium | manager-login › Manager can log in with valid credentials | ❌ **FAIL** | 8.7 s |
| 3 | chromium | manager-login › Manager sees alert with invalid credentials | ✅ pass | 4.6 s |
| 4 | firefox | create-customer › should create a new customer successfully | ❌ **FAIL** | 14.2 s |
| 5 | firefox | manager-login › Manager can log in with valid credentials | ❌ **FAIL** | 10.7 s |
| 6 | firefox | manager-login › Manager sees alert with invalid credentials | ✅ pass | 27.2 s |

```
  4 failed
    [chromium] › tests\create-customer.spec.ts:19:7 › Customer Management › should create a new customer successfully
    [chromium] › tests\manager-login.spec.ts:18:7 › Guru99 Bank - Manager Login › Manager can log in with valid credentials
    [firefox] › tests\create-customer.spec.ts:19:7 › Customer Management › should create a new customer successfully
    [firefox] › tests\manager-login.spec.ts:18:7 › Guru99 Bank - Manager Login › Manager can log in with valid credentials
  2 passed (1.6m)
```

#### Verbatim failure output

**Failure A — login with valid credentials (both browsers):**

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /Managerhomepage\.php/
Received string:  "https://demo.guru99.com/V4/index.php"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    - waiting for navigation to finish...
    - navigated to "https://demo.guru99.com/V4/index.php"
    13 × unexpected value "https://demo.guru99.com/V4/index.php"


      27 |     // Step 3: Verify navigation to the manager dashboard.
      28 |     // Successful login redirects to .../V4/manager/Managerhomepage.php
    > 29 |     await expect(page).toHaveURL(/Managerhomepage\.php/);
         |                        ^
      30 |   });
        at C:\Users\Dell Home\OneDrive\Desktop\Portfolio_repos\shakran-qa-portfolio-playwright\tests\manager-login.spec.ts:29:24
```

**Failure B — create customer (both browsers):**

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Customer Registered Successfully!!!')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Customer Registered Successfully!!!')
    - waiting for" https://demo.guru99.com/V4/manager/addcustomerpage.php" navigation to finish...
    - navigated to "https://demo.guru99.com/V4/manager/addcustomerpage.php"


      49 |     await expect(
      50 |       page.getByText('Customer Registered Successfully!!!')
    > 51 |     ).toBeVisible();
         |       ^
      52 |   });
        at C:\Users\Dell Home\OneDrive\Desktop\Portfolio_repos\shakran-qa-portfolio-playwright\tests\create-customer.spec.ts:51:7
```

#### Root cause — confirmed by direct probe, not inferred

The failures share one cause. To prove it rather than assume it, a throwaway script logged in with the exact `.env` credentials and captured the site's own dialog response (script deleted afterwards):

```
BASE_URL       : https://demo.guru99.com/V4/
USER (masked)  : mn***5
DIALOG MESSAGE : User or Password is not valid
FINAL URL      : https://demo.guru99.com/V4/index.php
AUTHENTICATED  : false
```

**The Guru99 server rejects the stored credentials with `"User or Password is not valid"`.** Guru99 demo access IDs are time-limited (they expire roughly 20 days after issue), and these were last known-good on 2026-06-03 — about three months ago.

Consequences, in order:
1. `manager-login › valid credentials` fails directly — login is refused, the browser stays on `index.php`.
2. `create-customer` fails *downstream*: it never authenticates, so `createPage.goto()` lands on an unauthenticated `addcustomerpage.php` where the submit does nothing and the success text never appears. **This test is not independently broken.**
3. `manager-login › invalid credentials` still passes — it only asserts that *bad* credentials produce the alert, which is now true for every credential.

`.env` is present and well-formed; all three variables are set (`GURU99_BASE_URL` 27 chars, `GURU99_USER` 10 chars, `GURU99_PASSWORD` 7 chars). **This is a data-expiry problem, not a missing-config or code problem.**

### 5.4 Untracked exploratory suites — 19 of 20 passed

`seaticket.spec.ts` + `vaani.spec.ts` were run. **`vcboom.spec.ts` was deliberately NOT run** — its TEST 2 attempts a real account signup on a third party's live Clerk backend (§3), which is not an appropriate side effect for an audit. Its 8 test runs are therefore **unverified** in this report; everything stated about it comes from reading the source.

```
$ npx playwright test tests/seaticket.spec.ts tests/vaani.spec.ts --reporter=list
```

**Duration: 4.9 m (297 s wall clock). Exit code: 1. Result: 19 passed, 1 failed.**

| Suite | Chromium | Firefox |
|---|---|---|
| seaticket TEST 1–5 | ✅ 5/5 | ✅ 5/5 |
| vaani TEST 1, 2, 4, 5 | ✅ 4/4 | ✅ 4/4 |
| vaani TEST 3 (Google OAuth) | ✅ pass | ❌ **FAIL** |

**The single failure, verbatim:**

```
  1) [firefox] › tests\vaani.spec.ts:146:7 › vaani.media — exploratory QA › TEST 3 — login page has no native form; auth is Google OAuth

    Test timeout of 30000ms exceeded.

    Error: page.goto: Test timeout of 30000ms exceeded.
    Call log:
      - navigating to "https://vaani.media/", waiting until "networkidle"


      148 |
      149 |     // Step 1: Reach /login the real way — via the homepage "Sign in" nav link.
    > 150 |     await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
          |                ^
      151 |     const signIn = page.locator('a:visible', { hasText: /^sign in$/i }).first();
        at C:\Users\Dell Home\OneDrive\Desktop\Portfolio_repos\shakran-qa-portfolio-playwright\tests\vaani.spec.ts:150:16
```

This is the config gap from §2.2, not a site bug: the test asks for a 60 s navigation timeout while the enclosing test timeout is the 30 s default, and `waitUntil: 'networkidle'` on a marketing page with long-lived connections doesn't settle in time on Firefox. **It is a flaky-by-construction test.** The same test passed on Chromium in the same run.

Substantive findings the suites logged (these are observations about the *sites*, working as designed):

- `seaticket.ai` — homepage clean, zero console/page errors, title `SeaTicket – AI-Native Ticket System for Unified Support`. Login rejects `abc@abc` with `"Incorrect account or password"`. No HTML5 `validationMessage` on empty submit. Dashboard correctly gates logged-out users to `/accounts/login/?next=/`. No horizontal overflow at 375 px. Back-button behaviour correct.
- `vaani.media` — homepage clean, zero console/page errors, title `Vaani — Voice, in every language`. `/studio` correctly redirects to `/login`; zero file inputs reachable logged-out. `/login` has **0** email inputs, **0** password inputs, **1** "Continue with Google" button — OAuth handoff confirmed reaching `accounts.google.com` (Supabase callback at `wwgwcvpsvizadqtxodmg.supabase.co/auth/v1/callback`). No horizontal overflow at 375 px.

Screenshot artifacts in `Results/seaticket/` and `Results/vaani/` were refreshed by this run (timestamps 2026-09-02 11:25–11:27). `Results/vcboom/` remains at 2026-06-20.

### 5.5 Total verified runtime

| Run | Tests | Result | Wall clock |
|---|---|---|---|
| Guru99 committed suite | 6 | 2 pass / 4 fail | **96 s** |
| seaticket + vaani | 20 | 19 pass / 1 fail | **297 s** |
| vcboom | 8 | *not run* | — |
| **Verified total** | **26 of 34** | **21 pass / 5 fail** | **≈ 6.5 min** |

A full 34-test run would land around **8–9 minutes**, single-worker, with `trace: 'on'` and `screenshot: 'on'` adding meaningful overhead.

> Note: these runs used `--reporter=list`, which overrides the configured HTML reporter — so **no new `Results/test-report <timestamp>/` folder was created today.** The newest HTML report on disk is still `test-report 2026-06-26 06-13-27`. Run without `--reporter` to regenerate one.

---

## 6. Known issues / TODO

### 6.1 Repo-wide marker search

Searched the whole repo (excluding `node_modules/`) for `TODO`, `FIXME`, `HACK`, `XXX`, `BUG:`, `NOTE:`, `WIP`. **Exactly one hit:**

| File | Line | Content |
|---|---|---|
| [tests/vcboom.spec.ts:158](tests/vcboom.spec.ts#L158) | 158 | `// NOTE: this is a real signup attempt against a live Clerk backend. It may surface a verification step, a CAPTCHA, or an "email taken" message — all of which are interesting outcomes we capture rather than assert on.` |

**There are no `TODO`, `FIXME`, `HACK`, or `XXX` comments anywhere in this codebase.** Nothing was left half-finished with a marker on it — which also means there is no breadcrumb trail of intent to recover.

### 6.2 Documented notes — README.md, verbatim

There is **no `CLAUDE.md`** and **no notes/lessons file** in this repo. The only prose is README.md's "Key Implementation Notes" section, reproduced verbatim:

> ## Key Implementation Notes
>
> - **Page Object Model**: each page has its own class with readonly locators and action methods — tests stay clean and readable
> - **Cross-browser dialog handling**: Guru99's login failure triggers a native browser `alert()`. Used `page.waitForEvent('dialog')` instead of `page.on('dialog')` for reliable cross-browser support including Firefox headless
> - **Credential security**: login credentials stored in `.env` (gitignored). `.env.example` provided as a template
> - **Sequential execution**: `workers: 1` prevents flakiness on the Guru99 demo server under parallel load

And from `.env.example`, verbatim — the one place the credential-expiry problem is foreshadowed:

> ```
> # Copy this file to .env and fill in your real credentials.
> # Get fresh Guru99 credentials by visiting https://demo.guru99.com/
> ```

The same guidance is embedded in the fail-fast guard in both committed specs:

> ```
> 'Missing GURU99_USER or GURU99_PASSWORD. '
> 'Copy .env.example to .env and fill in your Guru99 credentials. '
> 'Get fresh credentials at https://demo.guru99.com/'
> ```

Note that this guard only fires when the variables are **absent**. It cannot detect **expired** credentials — which is precisely the failure mode you have now.

### 6.3 Issues found during this audit (not previously documented anywhere)

| # | Severity | Issue |
|---|---|---|
| 1 | 🔴 **Blocker** | Guru99 credentials in `.env` are expired — server returns `"User or Password is not valid"`. Breaks 4 of 6 committed tests. |
| 2 | 🟠 High | `package.json` `"scripts"` is empty — no `npm test`. |
| 3 | 🟠 High | `vcboom.spec.ts` performs a real signup against a third party's production Clerk backend on every run. |
| 4 | 🟡 Medium | Config sets no global `timeout`, so the `{ timeout: 60000 }` on ~20 `page.goto()` calls in `vaani`/`vcboom` is unreachable under the 30 s default. Caused the one exploratory failure. |
| 5 | 🟡 Medium | 3 of 5 spec files (14 of 17 tests, ~750 lines) are **untracked** — one `git clean` from gone, and absent from any backup or the GitHub remote. |
| 6 | 🟡 Medium | README documents only the 3 committed tests; the working tree has 17. The README's "All 6 tests passing" screenshot is now stale. |
| 7 | 🟢 Low | `workers` comment ("unlimited locally") contradicts the hard-coded `1`. |
| 8 | 🟢 Low | `video: 'retain-on-failure'` comment claims "first retry only" — inaccurate. |
| 9 | 🟢 Low | `tsconfig` uses deprecated `node10` resolution, silenced via `ignoreDeprecations: "6.0"`. |
| 10 | 🟢 Low | Cruft: stale `playwright-report/` (2026-06-03), 5 accumulated `Results/test-report */` folders never cleaned, obsolete `pages/.gitkeep`, dead `"main": "index.js"`, and a stale `.claude/settings.local.json` permission for `node explore-vcboom2.mjs` (that file no longer exists). |

---

## 7. Git history

**Branch:** `main`, tracking `origin/main`
**Remote:** `https://github.com/shakransiddiqui-official/shakran-qa-portfolio-playwright.git`
**Total commits in repo history: 3.** (You asked for the last 15 — there are only 3.)

| # | Hash | Date | Author | Message |
|---|---|---|---|---|
| 1 | `6268628` | 2026-06-03 12:27:32 +0600 | Shakran Siddiqui | `feat: Session 5 polish — tsconfig, README, timestamped Results, workers=1` |
| 2 | `83413fc` | 2026-06-03 11:27:37 +0600 | Shakran Siddiqui | `test: add negative login test with cross-browser dialog handling` |
| 3 | `3207f3c` | 2026-06-03 10:43:31 +0600 | Shakran Siddiqui | `Session 3: CustomerCreatePage + create-customer spec, cross-browser passing` |

All three commits landed within **under 2 hours on a single day**, 2026-06-03.

### Time since last commit

**Last commit: 2026-06-03. Today: 2026-09-02 → 91 days ≈ 3 months.**

But the repo understates your actual last activity. Artifacts on disk show you were working here **after** the last commit and never committed it:

- `Results/vcboom/` screenshots — **2026-06-20**
- `Results/vaani/` screenshots — **2026-06-20**
- `Results/seaticket/` + `test-report 2026-06-26 …` — **2026-06-26**

So: **last commit ~3 months ago; last actual work ~2¼ months ago (2026-06-26), and that work was never committed.**

### Working tree — **NOT clean**

```
$ git status --porcelain
?? tests/seaticket.spec.ts
?? tests/vaani.spec.ts
?? tests/vcboom.spec.ts
```

Three untracked files, **746 lines of test code**, never committed and never pushed. No modified or staged files — the tracked files are all clean, and `main` is in sync with `origin/main`. The exposure is entirely in the untracked work.

---

## 8. Honest current-state verdict

### Does it run cleanly out of the box? **No.**

**The committed test suite is broken. 4 of its 6 test runs fail.** If you cloned this repo today, followed the README exactly, and ran `npx playwright test`, you would get a red suite — and the README screenshot showing "6 passed" would be actively misleading.

### The specific blocker

**Your Guru99 demo credentials in `.env` have expired.** Not "might have" — verified directly against the live server, which answers the stored `GURU99_USER`/`GURU99_PASSWORD` pair with:

```
"User or Password is not valid"
```

Guru99 issues time-limited demo access IDs that expire in roughly 20 days. Yours were valid on 2026-06-03. It is 2026-09-02.

**That single fact explains all 4 failures.** `manager-login › valid credentials` fails at the login itself; `create-customer` fails as a downstream consequence of never being authenticated. The two-test spread across two browsers is just 2 × 2.

### What is *not* broken — and this matters

Be clear about what you're picking back up. The engineering is in good shape:

- ✅ `npm install` — clean, 8 packages, **0 vulnerabilities, 0 warnings**
- ✅ `npx tsc --noEmit` — **passes with zero errors** under `strict: true`
- ✅ Browser binaries installed and working
- ✅ Playwright 1.60.0 pinned exactly; lockfile in sync
- ✅ POM layer is clean and correct — no assertions in page objects, lazy locators, documented selector rationale
- ✅ The negative-path login test **passes on both browsers**, proving navigation, the POM, `baseURL` resolution, and the cross-browser dialog handling all still work
- ✅ The exploratory suites are largely healthy — **19 of 20 passed**

**No code is wrong. One piece of expired data is.**

### Fix path

1. **Unblocks everything (≈2 minutes):** get fresh credentials at https://demo.guru99.com/ (submit your email; they arrive immediately), update `GURU99_USER` / `GURU99_PASSWORD` in `.env`, re-run. Expect 6/6 green. **Do this before touching anything else — it is the whole blocker.**
2. **Commit the 746 untracked lines**, or consciously delete them. Right now they are one `git clean -fd` from being gone and exist in exactly one place on earth. Given they audit third-party production sites, consider a separate branch or repo rather than the portfolio's `main`.
3. **Add `scripts` to `package.json`** — `test`, `test:headed`, `report`. Its absence is the first thing a reviewer of a QA portfolio will notice.
4. **Decide about `vcboom.spec.ts` TEST 2 Case C.** Creating real accounts on someone else's production Clerk instance on every run is a liability, not a feature. Gate it behind an env flag or drop the case.
5. **Set a global `timeout: 60000`** in `playwright.config.ts` so the exploratory specs' 60 s navigation timeouts are actually reachable, and the Firefox `vaani` TEST 3 flake stops.
6. **Guard against recurrence:** since the fail-fast check only catches *missing* credentials, add a `globalSetup` that performs one login and fails loudly with "credentials expired — get fresh ones at demo.guru99.com" so future-you gets a 5-second diagnosis instead of four confusing assertion failures.
7. **Refresh README** once green: it claims 3 tests when the tree has 17, and its "all passing" screenshot needs a re-shoot.

### Bottom line

You are picking up a **structurally sound project with a dead battery.** The blocker is external, well-understood, and fixable in about two minutes without editing a single line of code. The genuine risk here is not the failing tests — it is the **746 lines of uncommitted, unpushed, unbacked-up test code** sitting in your working tree, which will quietly disappear the first time anyone cleans this directory.

---

*Audit performed 2026-09-02. Commands executed: `npm install`, `npm test`, `npx playwright test` (×2), `npx playwright test --list`, `npx tsc --noEmit`, `git log`/`git status`, plus a one-off credential probe (created and deleted during the audit). `tests/vcboom.spec.ts` was not executed, by design.*
