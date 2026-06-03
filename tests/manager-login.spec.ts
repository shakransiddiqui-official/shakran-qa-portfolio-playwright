import { test, expect } from '@playwright/test';
import { ManagerLoginPage } from '../pages/ManagerLoginPage';

// Read credentials once, fail fast with a clear message if missing.
// This protects reviewers and future-you from confusing "undefined" errors.
const userId = (globalThis as any).process?.env?.GURU99_USER;
const password = (globalThis as any).process?.env?.GURU99_PASSWORD;

if (!userId || !password) {
  throw new Error(
    'Missing GURU99_USER or GURU99_PASSWORD. ' +
    'Copy .env.example to .env and fill in your Guru99 credentials. ' +
    'Get fresh credentials at https://demo.guru99.com/'
  );
}

test.describe('Guru99 Bank - Manager Login', () => {
  test('Manager can log in with valid credentials', async ({ page }) => {
    const loginPage = new ManagerLoginPage(page);

    // Step 1: Navigate to the manager login page.
    await loginPage.goto();

    // Step 2: Submit valid credentials.
    await loginPage.login(userId, password);

    // Step 3: Verify navigation to the manager dashboard.
    // Successful login redirects to .../V4/manager/Managerhomepage.php
    await expect(page).toHaveURL(/Managerhomepage\.php/);
  });

  test('Manager sees alert with invalid credentials', async ({ page }) => {
    const loginPage = new ManagerLoginPage(page);

    // Step 1: Navigate to the login page.
    await loginPage.goto();

    // Step 2: Set up a promise that resolves when the dialog event fires.
    // We use waitForEvent instead of page.on('dialog') because waitForEvent
    // works reliably across Chromium and Firefox (including headless mode).
    const dialogPromise = page.waitForEvent('dialog');

    // Step 3: Submit invalid credentials — this triggers the alert.
    await loginPage.login('wronguser', 'wrongpassword');

    // Step 4: Wait for the dialog and capture it.
    const dialog = await dialogPromise;

    // Step 5: Assert the alert message matches exactly.
    expect(dialog.message()).toBe('User or Password is not valid');

    // Step 6: Dismiss the alert (equivalent to clicking OK).
    await dialog.dismiss();

    // Step 7: Assert we are still on the login page (no navigation occurred).
    await expect(page).toHaveURL(/index\.php/);
  });
});
