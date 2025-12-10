import { expect, test, type Page } from '@playwright/test';

const mockedTokenResponse = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  token_type: 'bearer',
  user: { id: 'user-123', email: 'test@example.com' },
};

const starterCollectionResponse = {
  data: [
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
      capturedAt: '2025-01-01T00:00:00Z',
      isCaught: true,
    },
    {
      pokemonId: 4,
      name: 'charmander',
      sprites: {
        front_default:
          'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png',
        front_shiny:
          'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/4.png',
      },
      types: [{ id: 10, name: 'fire', slot: 1 }],
      variant: 'normal',
      capturedAt: '2025-01-02T00:00:00Z',
      isCaught: true,
    },
    {
      pokemonId: 7,
      name: 'squirtle',
      sprites: {
        front_default:
          'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png',
        front_shiny:
          'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/7.png',
      },
      types: [{ id: 11, name: 'water', slot: 1 }],
      variant: 'normal',
      capturedAt: '2025-01-03T00:00:00Z',
      isCaught: true,
    },
  ],
  pagination: { total: 3, limit: 3, offset: 0, hasMore: false },
};

const starterStatsResponse = {
  totalCaptured: 3,
  totalPossible: 151,
  percentage: 1.98,
  shinyCount: 0,
  variantBreakdown: { normal: 3, shiny: 0 },
  typeBreakdown: [
    { typeId: 12, typeName: 'grass', count: 1 },
    { typeId: 4, typeName: 'poison', count: 1 },
    { typeId: 10, typeName: 'fire', count: 1 },
    { typeId: 11, typeName: 'water', count: 1 },
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

test("collection page shows user's caught Pokémon (starters)", async ({ page }) => {
  await mockAuth(page);

  // Collection data mocks
  await page.route('**/api/collection?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(starterCollectionResponse),
    }),
  );
  await page.route('**/api/collection/stats*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(starterStatsResponse),
    }),
  );

  // Flow: go directly to collection -> see starters
  await page.goto('/collection');
  const starters = ['bulbasaur', 'charmander', 'squirtle'] as const;
  for (const name of starters) {
    const card = page.locator(`[data-test-id="collection-card-${name}"]`);
    await expect(card).toBeVisible();
  }
});
