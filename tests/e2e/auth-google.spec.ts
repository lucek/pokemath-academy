// import { expect, test } from "@playwright/test";

// const mockedTokenResponse = {
//   access_token: "mock-access-token",
//   refresh_token: "mock-refresh-token",
//   token_type: "bearer",
//   user: { id: "user-123", email: "test@example.com" },
// };

// test("login flow works (mocked OAuth via Supabase)", async ({ page }) => {
//   await page.route("**/auth/v1/token*", (route) =>
//     route.fulfill({
//       status: 200,
//       contentType: "application/json",
//       body: JSON.stringify(mockedTokenResponse),
//     })
//   );

//   await page.route("**/auth/v1/user*", (route) =>
//     route.fulfill({
//       status: 200,
//       contentType: "application/json",
//       body: JSON.stringify(mockedTokenResponse.user),
//     })
//   );

//   await page.goto("/");
//   await page.click('[data-test-id="login-google"]');

//   await page.waitForURL("**/dashboard");
//   await page.waitForSelector('[data-test-id="user-avatar"]');
//   await expect(page.locator('[data-test-id="user-avatar"]')).toBeVisible();
// });

// test("login fails on invalid grant", async ({ page }) => {
//   await page.route("**/auth/v1/token*", (route) =>
//     route.fulfill({
//       status: 401,
//       contentType: "application/json",
//       body: JSON.stringify({ error: "invalid_grant" }),
//     })
//   );

//   await page.goto("/");
//   await page.click('[data-test-id="login-google"]');

//   await page.waitForSelector('[data-test-id="login-error"]');
//   await expect(page.locator('[data-test-id="login-error"]')).toBeVisible();
// });
