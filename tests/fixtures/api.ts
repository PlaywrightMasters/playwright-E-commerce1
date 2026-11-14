import { test as base } from '@playwright/test';
import { ShopApi } from '../support/shop-api';

/** Browser-free fixtures for API tests. Each test gets its own cookie jar via `request`. */
export const test = base.extend<{ api: ShopApi }>({
  api: async ({ request }, use) => use(new ShopApi(request)),
});

export { expect } from '@playwright/test';
