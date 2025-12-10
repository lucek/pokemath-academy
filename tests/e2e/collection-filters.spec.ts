import { expect, test, type Page } from '@playwright/test';

const mockedTokenResponse = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  token_type: 'bearer',
  user: { id: 'user-123', email: 'test@example.com' },
};

const collectionResponse = {
  data: [
    {
      pokemonId: 25,
      name: 'pikachu',
      sprites: {
        front_default:
          'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png',
        front_shiny:
          'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/25.png',
      },
      types: [{ id: 13, name: 'electric', slot: 1 }],
      variant: 'shiny',
      capturedAt: '2025-01-01T00:00:00Z',
      isCaught: true,
    },
    {
      pokemonId: 1,
      name: 'bulbasaur',
      sprites: {
        front_default:
          'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png',
        front_shiny:
          'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/1.png',
      },
      types: [
        { id: 12, name: 'grass', slot: 1 },
        { id: 4, name: 'poison', slot: 2 },
      ],
      variant: 'normal',
      capturedAt: '2025-01-02T00:00:00Z',
      isCaught: true,
    },
    {
      pokemonId: 130,
      name: 'gyarados',
      sprites: {
        front_default:
          'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/130.png',
        front_shiny:
          'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/130.png',
      },
      types: [
        { id: 11, name: 'water', slot: 1 },
        { id: 3, name: 'flying', slot: 2 },
      ],
      variant: 'shiny',
      capturedAt: '2025-01-03T00:00:00Z',
      isCaught: true,
    },
  ],
  pagination: { total: 3, limit: 3, offset: 0, hasMore: false },
};

const collectionStatsResponse = {
  totalCaptured: 3,
  totalPossible: 151,
  percentage: 1.99,
  shinyCount: 2,
  variantBreakdown: { normal: 1, shiny: 2 },
  typeBreakdown: [
    { typeId: 13, typeName: 'electric', count: 1 },
    { typeId: 11, typeName: 'water', count: 1 },
    { typeId: 3, typeName: 'flying', count: 1 },
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

test('collection filters isolate shiny and by type', async ({ page }) => {
  await mockAuth(page);

  await page.route('**/api/collection?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(collectionResponse),
    }),
  );

  await page.route(/\/api\/collection(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(collectionResponse),
    }),
  );

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

  await page.goto('/');
  await page.click('[data-test-id="login-google"]');
  await page.waitForURL('**/dashboard');
  await expect(page.locator('[data-test-id="user-avatar"]')).toBeVisible();

  await page.goto('/collection');
  await expect(page.locator('[data-test-id="collection-filters-toggle"]')).toBeVisible();

  const pikachuCard = page.locator('[data-test-id="collection-card-pikachu"]');
  const bulbasaurCard = page.locator('[data-test-id="collection-card-bulbasaur"]');
  const gyaradosCard = page.locator('[data-test-id="collection-card-gyarados"]');

  await expect(pikachuCard).toBeVisible();
  await expect(bulbasaurCard).toBeVisible();
  await expect(gyaradosCard).toBeVisible();

  await page.locator('[data-test-id="collection-filters-toggle"]').click();
  await page.locator('[data-test-id="variant-filter-shiny"]').click();

  await expect(bulbasaurCard).toHaveCount(0);
  await expect(pikachuCard).toBeVisible();
  await expect(gyaradosCard).toBeVisible();

  await page.locator('[data-test-id="type-filter-electric"]').click();

  await expect(pikachuCard).toBeVisible();
  await expect(gyaradosCard).toHaveCount(0);
});
