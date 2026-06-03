import { Page, Locator } from '@playwright/test';

/**
 * Page Object for the Guru99 Bank "New Customer" creation page.
 *
 * Models the form found at https://demo.guru99.com/V4/manager/addcustomerpage.php
 * which captures customer details (name, gender, DOB, address, etc.) and
 * persists a new customer record on submit.
 *
 * Usage:
 *   const createPage = new CustomerCreatePage(page);
 *   await createPage.goto();
 *   await createPage.fillForm({ ... });
 *   await createPage.submit();
 */
export class CustomerCreatePage {
  // Element locators are exposed as readonly Locator properties.
  // Playwright's Locator is "lazy" — the page is queried only when
  // an action like .fill() or .click() is invoked.
  readonly nameInput: Locator;
  readonly genderMale: Locator;
  readonly genderFemale: Locator;
  readonly dobInput: Locator;
  readonly addressInput: Locator;
  readonly cityInput: Locator;
  readonly stateInput: Locator;
  readonly pinInput: Locator;
  readonly mobileInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly resetButton: Locator;

  constructor(private readonly page: Page) {
    // CSS attribute selectors based on the Guru99 add-customer form structure.
    this.nameInput     = page.locator('input[name="name"]');
    this.genderMale    = page.locator('input[name="rad1"][value="m"]');
    this.genderFemale  = page.locator('input[name="rad1"][value="f"]');
    this.dobInput      = page.locator('input[name="dob"]');
    this.addressInput  = page.locator('textarea[name="addr"]');
    this.cityInput     = page.locator('input[name="city"]');
    this.stateInput    = page.locator('input[name="state"]');
    this.pinInput      = page.locator('input[name="pinno"]');
    this.mobileInput   = page.locator('input[name="telephoneno"]');
    this.emailInput    = page.locator('input[name="emailid"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.submitButton  = page.locator('input[name="sub"]');
    this.resetButton   = page.locator('input[name="res"]');
  }

  /**
   * Navigate to the add-customer page.
   * Path is relative to the baseURL (https://demo.guru99.com/v4/)
   * configured in playwright.config.ts.
   */
  async goto(): Promise<void> {
    await this.page.goto('manager/addcustomerpage.php');
  }

  /**
   * Fill every field on the customer form.
   * Gender is always set to Male.
   */
  async fillForm(data: {
    name: string;
    dob: string;
    address: string;
    city: string;
    state: string;
    pin: string;
    mobile: string;
    email: string;
    password: string;
  }): Promise<void> {
    await this.nameInput.fill(data.name);
    await this.genderMale.check();
    await this.dobInput.fill(data.dob);
    await this.addressInput.fill(data.address);
    await this.cityInput.fill(data.city);
    await this.stateInput.fill(data.state);
    await this.pinInput.fill(data.pin);
    await this.mobileInput.fill(data.mobile);
    await this.emailInput.fill(data.email);
    await this.passwordInput.fill(data.password);
  }

  /**
   * Submit the form to create the customer.
   */
  async submit(): Promise<void> {
    await this.submitButton.click();
  }
}
