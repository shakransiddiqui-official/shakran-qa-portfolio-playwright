import { test, expect } from '@playwright/test';
import { ManagerLoginPage } from '../pages/ManagerLoginPage';
import { CustomerCreatePage } from '../pages/CustomerCreatePage';

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

test.describe('Customer Management', () => {
  test('should create a new customer successfully', async ({ page }) => {
    const loginPage = new ManagerLoginPage(page);
    const createPage = new CustomerCreatePage(page);

    // Step 1: Log in as manager with valid credentials.
    await loginPage.goto();
    await loginPage.login(userId, password);

    // Step 2: Navigate to the add-customer page.
    await createPage.goto();

    // Step 3: Fill the form with test data.
    // The email is made unique per-run with Date.now() so repeated runs
    // don't collide on the "email already exists" validation.
    await createPage.fillForm({
      name: 'Test User',
      dob: '1990-01-15',
      address: '123 Test Street',
      city: 'Testville',
      state: 'Teststate',
      pin: '123456',
      mobile: '9876543210',
      email: `test${Date.now()}@example.com`,
      password: 'Test@1234',
    });

    // Step 4: Submit the form to create the customer.
    await createPage.submit();

    // Step 5: Verify the success message confirms registration.
    await expect(
      page.getByText('Customer Registered Successfully!!!')
    ).toBeVisible();
  });
});
