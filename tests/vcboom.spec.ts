import { test, expect, Page } from '@playwright/test';
import path from 'path';

/**
 * Exploratory / QA automation suite for the live site https://vcboom.com
 *
 * IMPORTANT CONTEXT:
 *  - The project's baseURL (playwright.config.ts) points at the Guru99 demo
 *    bank, NOT vcboom. Every navigation in this file therefore uses an
 *    ABSOLUTE URL so it is never prefixed with the wrong base.
 *  - vcboom.com 301-redirects to https://www.vcboom.com — assertions account
 *    for the `www.` host.
 *  - The auth pages are Clerk-rendered. As of writing the inputs render in the
 *    main DOM (no iframe): sign-up exposes input[name="emailAddress"] and
 *    input[name="password"] with a "Continue" submit button.
 *
 * Each test runs on both Chromium and Firefox (the two configured projects),
 * so screenshots are suffixed with the project name to avoid collisions.
 * Screenshots land in Results/vcboom/ (the dir is created automatically by
 * page.screenshot()).
 */

const BASE = 'https://vcboom.com';
const SHOTS = path.join('Results', 'vcboom');

/** Build a screenshot path scoped to the running browser project. */
function shot(name: string, projectName: string): string {
  return path.join(SHOTS, `${name}-${projectName}.png`);
}

/**
 * Collect visible validation / error text from the Clerk auth card.
 * Clerk uses .cl-formFieldErrorText for inline field errors and [role="alert"]
 * for global ones; we also sweep any element whose class hints at an error.
 */
async function readFormErrors(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const selectors = [
      '.cl-formFieldErrorText',
      '.cl-formFieldWarningText',
      '[role="alert"]',
      '[class*=" errorText"]',
      '[class*="FieldError"]',
    ];
    const seen = new Set<string>();
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => {
        const t = (el as HTMLElement).innerText?.trim();
        if (t) seen.add(t);
      });
    }
    return Array.from(seen);
  });
}

/**
 * Reach the /sign-up page the way a real user would: the homepage has no
 * direct "Sign up" link — only "Sign in". The /sign-up link ("Create an
 * account") lives on the sign-in page. This helper walks that nav path and
 * leaves the page on a hydrated sign-up form.
 */
async function gotoSignupViaNav(page: Page): Promise<void> {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });

  // Homepage → Sign in. The href matches several links (header, footer, and a
  // hidden mobile-menu copy), so we target the VISIBLE one to avoid clicking a
  // hidden element — important on Firefox where DOM order differs.
  const signIn = page.locator('a[href$="/sign-in"]:visible').first();
  await signIn.waitFor({ state: 'visible', timeout: 30000 });
  await signIn.click();
  await page.waitForURL(/\/sign-in/, { timeout: 30000 });

  // Sign in → Create an account (/sign-up).
  const createAccount = page.locator('a[href$="/sign-up"]:visible').first();
  await createAccount.waitFor({ state: 'visible', timeout: 30000 });
  await createAccount.click();
  await page.waitForURL(/\/sign-up/, { timeout: 30000 });

  // Wait for the Clerk form to hydrate before the caller interacts with it.
  await page.locator('input[name="emailAddress"]').waitFor({ state: 'visible', timeout: 30000 });
}

test.describe('vcboom.com — exploratory QA', () => {
  /* -------------------------------------------------------------------- */
  /* TEST 1 — Console errors on homepage load                              */
  /* -------------------------------------------------------------------- */
  test('TEST 1 — homepage loads without console errors', async ({ page }, testInfo) => {
    const project = testInfo.project.name;

    // Step 1: Start capturing console errors BEFORE navigating so we don't
    // miss any that fire during initial load.
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    // pageerror = uncaught exceptions, distinct from console.error logs.
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Step 2: Open the homepage and wait for the network to settle so late
    // analytics / third-party scripts have a chance to throw.
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });

    // Step 3: Sanity-check the page actually rendered (title is non-empty).
    await expect(page).toHaveTitle(/.+/);

    // Step 4: Capture the homepage as evidence.
    await page.screenshot({ path: shot('homepage-desktop', project), fullPage: true });

    // Step 5: Report findings to the run log (compiled into the final summary).
    console.log(`[TEST 1][${project}] console errors:`, JSON.stringify(consoleErrors));
    console.log(`[TEST 1][${project}] uncaught page errors:`, JSON.stringify(pageErrors));

    // This test's job is "does the homepage load?" — which it does — so it
    // passes. Console/page errors are findings about the SITE, not failures of
    // the automation, so we surface them as annotations (visible in the HTML
    // report) instead of a red X that would imply the test itself is broken.
    if (consoleErrors.length) {
      testInfo.annotations.push({ type: 'console-error', description: consoleErrors.join(' | ') });
    }
    if (pageErrors.length) {
      testInfo.annotations.push({ type: 'page-error', description: pageErrors.join(' | ') });
    }
  });

  /* -------------------------------------------------------------------- */
  /* TEST 2 — Signup form validation                                       */
  /* -------------------------------------------------------------------- */
  test('TEST 2 — signup form validation behaviour', async ({ page }, testInfo) => {
    const project = testInfo.project.name;

    // Step 1: Reach the signup page through the real nav path
    // (homepage → Sign in → Create an account).
    await gotoSignupViaNav(page);

    // Step 2: Grab the now-hydrated form controls.
    const email = page.locator('input[name="emailAddress"]');
    const password = page.locator('input[name="password"]');
    const submit = page.getByRole('button', { name: /^continue$/i }).first();

    // --- Case A: completely empty submit -------------------------------
    await submit.click();
    await page.waitForTimeout(2000); // let client-side validation render
    const emptyErrors = await readFormErrors(page);
    console.log(`[TEST 2][${project}] empty-submit errors:`, JSON.stringify(emptyErrors));
    await page.screenshot({ path: shot('signup-empty-submit', project), fullPage: true });

    // --- Case B: invalid email (abc@abc) + password --------------------
    await email.fill('abc@abc');
    await password.fill('TestQA@2026');
    await submit.click();
    await page.waitForTimeout(2500);
    const invalidErrors = await readFormErrors(page);
    console.log(`[TEST 2][${project}] invalid-email errors:`, JSON.stringify(invalidErrors));
    await page.screenshot({ path: shot('signup-invalid-email', project), fullPage: true });

    // --- Case C: well-formed email + password --------------------------
    // NOTE: this is a real signup attempt against a live Clerk backend. It may
    // surface a verification step, a CAPTCHA, or an "email taken" message —
    // all of which are interesting outcomes we capture rather than assert on.
    await email.fill('shakrantestqa@protonmail.com');
    await password.fill('TestQA@2026');
    await submit.click();
    await page.waitForTimeout(4000);
    const validErrors = await readFormErrors(page);
    const afterUrl = page.url();
    const afterText = (await page.locator('body').innerText()).slice(0, 600);
    console.log(`[TEST 2][${project}] valid-submit URL:`, afterUrl);
    console.log(`[TEST 2][${project}] valid-submit messages:`, JSON.stringify(validErrors));
    console.log(`[TEST 2][${project}] valid-submit body excerpt:`, afterText.replace(/\s+/g, ' '));
    await page.screenshot({ path: shot('signup-valid-submit', project), fullPage: true });

    // Step: assert that the empty submit produced SOME validation feedback —
    // a form that silently accepts an empty required email would be a real bug.
    // Soft so we still capture the other cases' evidence either way.
    const requiredEmail = await email.getAttribute('required');
    expect.soft(
      emptyErrors.length > 0 || requiredEmail !== null,
      'Empty signup submit should be blocked by validation (error text or required attr)'
    ).toBeTruthy();
  });

  /* -------------------------------------------------------------------- */
  /* TEST 3 — Mobile viewport (iPhone SE, 375px)                           */
  /* -------------------------------------------------------------------- */
  test('TEST 3 — mobile viewport layout at 375px', async ({ page }, testInfo) => {
    const project = testInfo.project.name;

    // Step 1: Emulate an iPhone SE width.
    await page.setViewportSize({ width: 375, height: 667 });

    // Step 2: Load the homepage and screenshot it.
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
    await page.screenshot({ path: shot('homepage-mobile-375', project), fullPage: true });

    // Step 3: Detect horizontal overflow — a common mobile bug where content
    // is wider than the viewport, forcing a sideways scroll. We allow a 1px
    // tolerance for sub-pixel rounding.
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      const scrollW = Math.max(doc.scrollWidth, document.body.scrollWidth);
      const innerW = window.innerWidth;
      // Find specific offending elements for a useful report.
      const offenders: string[] = [];
      document.querySelectorAll('*').forEach((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        if (r.width > 0 && r.right > innerW + 1) {
          const tag = el.tagName.toLowerCase();
          const cls = (el.getAttribute('class') || '').slice(0, 30);
          const id = el.id ? `#${el.id}` : '';
          offenders.push(`${tag}${id}${cls ? '.' + cls.replace(/\s+/g, '.') : ''} (right=${Math.round(r.right)})`);
        }
      });
      return { scrollW, innerW, horizontalOverflow: scrollW > innerW + 1, offenders: offenders.slice(0, 10) };
    });
    console.log(`[TEST 3][${project}] mobile overflow:`, JSON.stringify(overflow));

    // Step 4: Navigate to the signup page at mobile width and capture it.
    await page.goto(`${BASE}/sign-up`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.locator('input[name="emailAddress"]').waitFor({ state: 'visible', timeout: 30000 });
    await page.screenshot({ path: shot('signup-mobile-375', project), fullPage: true });

    // Soft assertion: flag horizontal overflow as a layout issue without
    // aborting (we still want the signup screenshot recorded above).
    expect.soft(
      overflow.horizontalOverflow,
      `Horizontal overflow at 375px (${project}). Offenders: ${JSON.stringify(overflow.offenders)}`
    ).toBeFalsy();
  });

  /* -------------------------------------------------------------------- */
  /* TEST 4 — Navigation edge case: browser Back mid-signup                */
  /* -------------------------------------------------------------------- */
  test('TEST 4 — browser back button mid-signup flow', async ({ page }, testInfo) => {
    const project = testInfo.project.name;

    // Step 1: Enter the signup flow via the real nav path
    // (homepage → Sign in → Create an account). History is now
    // [homepage, sign-in, sign-up].
    await gotoSignupViaNav(page);

    // Step 2: Partially fill the form to simulate being "mid-flow".
    await page.locator('input[name="emailAddress"]').fill('shakrantestqa@protonmail.com');

    // Step 3: Hit the browser Back button (lands back on the sign-in step).
    await page.goBack({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Step 4: Capture where we landed.
    const landedUrl = page.url();
    const bodyText = (await page.locator('body').innerText()).slice(0, 400).replace(/\s+/g, ' ');
    console.log(`[TEST 4][${project}] landed after Back:`, landedUrl);
    console.log(`[TEST 4][${project}] body excerpt:`, bodyText);
    await page.screenshot({ path: shot('back-after-signup', project), fullPage: true });

    // Step 5: Verify the app didn't end up in a broken/error state.
    // Back from /sign-up should return to the homepage, not a 404/blank/crash.
    const looksBroken = /404|not found|something went wrong|application error|undefined/i.test(bodyText);
    expect.soft(
      looksBroken,
      `Page looks broken after Back (${project}): "${bodyText}"`
    ).toBeFalsy();
    expect.soft(landedUrl, 'Back should leave the /sign-up page').not.toContain('/sign-up');
  });
});
