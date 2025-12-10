import { expect, test, type Page } from '@playwright/test';

const mockedTokenResponse = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  token_type: 'bearer',
  user: { id: 'user-123', email: 'test@example.com' },
};

const collectionStatsResponse = {
  totalCaptured: 5,
  totalPossible: 151,
  percentage: 3.31,
  shinyCount: 1,
  variantBreakdown: { normal: 4, shiny: 1 },
  typeBreakdown: [
    { typeId: 13, typeName: 'electric', count: 1 },
    { typeId: 11, typeName: 'water', count: 1 },
    { typeId: 10, typeName: 'fire', count: 1 },
    { typeId: 12, typeName: 'grass', count: 1 },
    { typeId: 4, typeName: 'poison', count: 1 },
  ],
  recentCaptures: [],
};

async function mockAuth(page: Page): Promise<void> {
  await page.context().addCookies([
    { name: 'e2e-auth-mock', value: 'true', url: 'http://localhost:4173' },
    { name: 'e2e-auth-mock', value: 'true', url: 'http://127.0.0.1:4173' },
  ]);

  await page.route('**/auth/v1/token*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockedTokenResponse),
    }),
  );

  await page.route('**/auth/v1/user*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockedTokenResponse.user),
    }),
  );
}

test('dashboard shows collection stats and start encounter card', async ({ page }) => {
  await mockAuth(page);

  await page.route('**/api/collection/stats*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(collectionStatsResponse),
    }),
  );

  await page.route(/\/api\/collection\/stats(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(collectionStatsResponse),
    }),
  );

  await page.goto('/dashboard');

  await expect(page.getByRole('heading', { name: 'Collection Progress' })).toBeVisible();
  await expect(page.getByText('Pokémon Caught')).toBeVisible();
  await expect(page.getByText('Shiny Caught')).toBeVisible();
  await expect(page.getByRole('button', { name: /Start Encounter/i })).toBeVisible();
});
