import { test, expect } from '@playwright/test';

// Configuration
test.use({
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  }
});

test.describe.configure({ mode: 'parallel' });

test('Full hangout flow: signup, login, join call', async ({ browser }) => {
  test.setTimeout(60000);
  // Create two separate isolated browser contexts to simulate two different users
  const context1 = await browser.newContext({
    permissions: ['camera', 'microphone'],
    ignoreHTTPSErrors: true,
  });
  const context2 = await browser.newContext({
    permissions: ['camera', 'microphone'],
    ignoreHTTPSErrors: true,
  });

  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  page1.on('console', msg => console.log('PAGE1:', msg.text()));
  page2.on('console', msg => console.log('PAGE2:', msg.text()));

  // Helper function to sign up and log in
  const signupAndLogin = async (page, username, password) => {
    // Navigate to landing
    await page.goto('http://localhost:5173/');
    
    // Go to sign up
    await page.goto('http://localhost:5173/sign-up');
    
    // Fill sign up
    await page.fill('input[id="name"]', username);
    await page.fill('input[id="email"]', `${username}@test.com`);
    await page.fill('input[id="password"]', password);
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/signup/') && resp.request().method() === 'POST'),
      page.click('button:has-text("Sign Up")')
    ]);
    
    // The UI redirects to sign-in automatically after 1.5 seconds.
    await page.waitForURL('**/sign-in');

    // Fill sign in
    await page.fill('input[id="username"]', username);
    await page.fill('input[id="password"]', password);
    
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/signin/') && resp.request().method() === 'POST'),
      page.click('button:has-text("Sign In")')
    ]);

    // Wait for home page to load
    await page.waitForURL('**/home');
  };

  const randomSuffix = Math.floor(Math.random() * 1000000);
  const user1Name = `testuser1_${randomSuffix}`;
  const user2Name = `testuser2_${randomSuffix}`;

  console.log(`Signing up ${user1Name}...`);
  await signupAndLogin(page1, user1Name, 'TestPassword123!');
  console.log(`Signing up ${user2Name}...`);
  await signupAndLogin(page2, user2Name, 'TestPassword123!');

  // Now user1 creates or joins a call
  console.log('User1 joining room test-room...');
  await page1.fill('input[placeholder="Enter meeting code"]', 'test-room');
  await page1.click('button:has-text("Join")');
  
  // Wait for the modal and click the toggles
  await page1.waitForTimeout(1000);
  await page1.locator('button.w-12.h-6.rounded-full').nth(0).click(); // Camera
  await page1.locator('button.w-12.h-6.rounded-full').nth(1).click(); // Mic
  await page1.waitForTimeout(500);
  await page1.click('button:has-text("Join Call")');
  await page1.waitForURL('**/call/test-room');

  // User2 joins the same room
  console.log('User2 joining room test-room...');
  await page2.fill('input[placeholder="Enter meeting code"]', 'test-room');
  await page2.click('button:has-text("Join")');
  
  // Wait for User2 to click the toggles
  await page2.waitForTimeout(1000);
  await page2.locator('button.w-12.h-6.rounded-full').nth(0).click(); // Camera
  await page2.locator('button.w-12.h-6.rounded-full').nth(1).click(); // Mic
  await page2.waitForTimeout(500);
  await page2.click('button:has-text("Join Call")');
  await page2.waitForURL('**/call/test-room');
  
  // Wait for peers to connect
  await page1.waitForTimeout(5000);

  // Take screenshots to verify UI
  await page1.screenshot({ path: 'user1-call.png' });
  await page2.screenshot({ path: 'user2-call.png' });

  // Basic verifications
  const videoElements1 = await page1.locator('video').count();
  const videoElements2 = await page2.locator('video').count();
  
  console.log(`User1 video elements: ${videoElements1}`);
  console.log(`User2 video elements: ${videoElements2}`);

  // Both should have 2 video elements (local + remote)
  expect(videoElements1).toBe(2);
  expect(videoElements2).toBe(2);

  // Test chat functionality
  console.log('User1 sending a message...');
  await page1.click('button[title="Chat"]');
  await page1.fill('input[placeholder="Message…"]', 'Hello from User1!');
  await page1.click('button:has(svg.lucide-send)');

  await page2.waitForTimeout(1000);
  await page2.click('button[title="Chat"]');
  const user2sees = await page2.locator('text="Hello from User1!"').isVisible();
  console.log(`User 2 sees message: ${user2sees}`);

  // Test notes functionality
  console.log('User1 writing a note...');
  await page1.click('button[title="Notes"]');
  await page1.fill('textarea', 'Meeting notes from User 1');
  await page1.click('button:has-text("Save")');

  expect(user2sees).toBe(true);

  await context1.close();
  await context2.close();
});
