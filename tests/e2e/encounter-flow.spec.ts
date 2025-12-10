import { expect, test, type Page } from '@playwright/test';

const mockedTokenResponse = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  token_type: 'bearer',
  user: { id: 'user-123', email: 'test@example.com' },
};

const wildEncounterResponse = {
  encounterId: 'enc-wild-001',
  pokemon: {
    id: 25,
    name: 'pikachu',
    sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png',
    isShiny: false,
    stage: 1,
    flavorText: 'A mouse Pokémon that stores electricity in its cheeks.',
    types: [{ id: 13, name: 'electric', slot: 1 }],
  },
  questions: [
    { id: 'q1', question: '2 + 2', options: [4, 5, 6, 1] },
    { id: 'q2', question: '3 × 3', options: [9, 6, 3, 12] },
    { id: 'q3', question: '10 − 4', options: [6, 4, 8, 5] },
  ],
  attemptsRemaining: 2,
};

const emptyCollectionStatsResponse = {
  totalCaptured: 0,
  totalPossible: 151,
  percentage: 0,
  shinyCount: 0,
  variantBreakdown: { normal: 0, shiny: 0 },
  typeBreakdown: [],
  recentCaptures: [],
};

const submitSuccessResponse = {
  success: true as const,
  result: 'captured' as const,
  score: { correct: 3, total: 3 },
  pokemon: {
    id: 25,
    name: 'pikachu',
    sprite: wildEncounterResponse.pokemon.sprite,
    variant: 'normal' as const,
    capturedAt: '2025-01-04T00:00:00Z',
  },
  newCapture: true,
};

const submitFailureResponse = {
  success: false as const,
  result: 'failed' as const,
  score: { correct: 0, total: 3 },
  attemptsRemaining: 1,
  canRetry: true,
  message: 'Not enough correct answers. You can try again with the remaining attempts.',
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

async function answerQuestions(page: Page): Promise<void> {
  for (const question of wildEncounterResponse.questions) {
    await expect(page.getByRole('heading', { name: question.question })).toBeVisible();
    await page.locator(`[data-test-id="question-option-${question.id}-1"]`).click();
  }
}

async function mockDashboardStats(page: Page): Promise<void> {
  await page.route('**/api/collection/stats*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(emptyCollectionStatsResponse),
    }),
  );

  await page.route(/\/api\/collection\/stats(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(emptyCollectionStatsResponse),
    }),
  );
}

test('wild encounter capture succeeds', async ({ page }) => {
  await mockAuth(page);
  await mockDashboardStats(page);

  await page.route('**/api/encounters/wild', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(wildEncounterResponse),
    }),
  );

  await page.route('**/api/encounters/submit', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(submitSuccessResponse),
    }),
  );

  await page.goto('/dashboard');
  await expect(page.locator('[data-test-id="user-avatar"]')).toBeVisible();

  await page.locator('[data-test-id="start-encounter"]').click();
  await answerQuestions(page);

  await expect(page.locator('[data-test-id="encounter-status"]')).toHaveText('SUCCESS');
  await expect(page.locator('[data-test-id="encounter-new"]')).toBeVisible();
});

test('wild encounter failure allows retry then success', async ({ page }) => {
  await mockAuth(page);
  await mockDashboardStats(page);

  await page.route('**/api/encounters/wild', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(wildEncounterResponse),
    }),
  );

  let submitCount = 0;
  await page.route('**/api/encounters/submit', (route) => {
    submitCount += 1;
    const payload = submitCount === 1 ? submitFailureResponse : submitSuccessResponse;
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });
  });

  await page.goto('/dashboard');
  await expect(page.locator('[data-test-id="user-avatar"]')).toBeVisible();

  await page.locator('[data-test-id="start-encounter"]').click();
  await answerQuestions(page);

  await expect(page.locator('[data-test-id="encounter-status"]')).toHaveText('FAILURE');
  await expect(page.locator('[data-test-id="encounter-retries-remaining"]')).toContainText(
    '1 retry',
  );
  await page.locator('[data-test-id="encounter-retry"]').click();

  await answerQuestions(page);

  await expect(page.locator('[data-test-id="encounter-status"]')).toHaveText('SUCCESS');
  await expect(page.locator('[data-test-id="encounter-new"]')).toBeVisible();
});
