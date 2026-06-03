import { Page, Locator } from '@playwright/test';

/**
 * Page Object for the Guru99 Bank Manager Login page.
 *
 * Models the login form found at https://demo.guru99.com/V4/
 * which has a UserID input, a Password input, and a LOGIN button.
 *
 * Usage:
 *   const loginPage = new ManagerLoginPage(page);
 *   await loginPage.goto();
 *   await loginPage.login(userId, password);
 */
export class ManagerLoginPage {
  // Element locators are exposed as readonly Locator properties.
  // Playwright's Locator is "lazy" — the page is queried only when
  // an action like .fill() or .click() is invoked.
  readonly userIdInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly resetButton: Locator;

  constructor(private readonly page: Page) {
    // CSS attribute selectors based on the Guru99 form structure:
    //   <input type="text"     name="uid">
    //   <input type="password" name="password">
    //   <input type="submit"   name="btnLogin"   value="LOGIN">
    //   <input type="reset"    name="btnReset"   value="RESET">
    this.userIdInput   = page.locator('input[name="uid"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.loginButton   = page.locator('input[name="btnLogin"]');
    this.resetButton   = page.locator('input[name="btnReset"]');
  }

  /**
   * Navigate to the manager login page.
   * Uses '' (empty path) which resolves to the baseURL exactly,
   * configured to https://demo.guru99.com/v4/ in playwright.config.ts.
   * Note: Using '/' would incorrectly resolve to the domain root.
   */
  async goto(): Promise<void> {
    await this.page.goto('');
  }

  /**
   * Perform the full login flow: fill credentials and submit.
   * Waits for navigation away from the login page before returning.
   */
  async login(userId: string, password: string): Promise<void> {
    await this.userIdInput.fill(userId);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  /**
   * Click RESET to clear the form (useful for negative-test setup).
   */
  async reset(): Promise<void> {
    await this.resetButton.click();
  }
}
