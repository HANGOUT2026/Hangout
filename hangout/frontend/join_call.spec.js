import { test } from '@playwright/test';

test.use({
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  }
});

test('Bot joins call', async ({ browser }) => {
  test.setTimeout(180000); // 3 minutes timeout

  const context = await browser.newContext({
    permissions: ['camera', 'microphone'],
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();
  page.on('console', msg => console.log('BOT:', msg.text()));

  const username = `bot_${Date.now()}`;
  const password = `TestPassword123!`;

  console.log(`Signing up as ${username}...`);
  await page.goto('http://localhost:5173/sign-up');
  
  await page.fill('input[id="name"]', username);
  await page.fill('input[id="email"]', `${username}@test.com`);
  await page.fill('input[id="password"]', password);
  
  await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/api/signup/') && resp.request().method() === 'POST'),
    page.click('button:has-text("Sign Up")')
  ]);
  
  console.log("Waiting for redirect to sign in...");
  await page.waitForURL('**/sign-in');

  console.log("Signing in...");
  await page.fill('input[id="username"]', username);
  await page.fill('input[id="password"]', password);
  
  await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/api/signin/') && resp.request().method() === 'POST'),
    page.click('button:has-text("Sign In")')
  ]);

  console.log("Waiting for home page...");
  await page.waitForURL('**/home');

  const roomId = 's7ggkgr';
  console.log(`Joining room ${roomId}...`);
  
  await page.fill('input[placeholder="Enter meeting code"]', roomId);
  await page.click('button:has-text("Join")');

  console.log("Handling pre-join modal...");
  await page.waitForTimeout(1000);
  
  // Toggle camera
  await page.locator('button.w-12.h-6.rounded-full').nth(0).click();
  await page.waitForTimeout(500);
  // Toggle mic
  await page.locator('button.w-12.h-6.rounded-full').nth(1).click();
  await page.waitForTimeout(500);

  await page.click('button:has-text("Join Call")');
  await page.waitForURL(`**/call/${roomId}`);
  
  console.log("Successfully joined the call! Staying in the room for 120 seconds...");
  
  // Wait in the room for 2 minutes to allow the user to test
  await page.waitForTimeout(120000);

  console.log("Test finished, closing browser.");
});
