import { test } from '@playwright/test';
import path from 'path';

test.use({
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  }
});

test('3 Bots join call jqrzbvs and test features', async ({ browser }) => {
  test.setTimeout(240000); // 4 minutes

  const roomId = '5b9sphn';
  const artifactDir = 'c:/Users/subhr/.gemini/antigravity/brain/3fcca628-2258-47c5-9aa3-74f8a56f01ff/scratch/';

  const createBot = async (botIndex) => {
    const context = await browser.newContext({
      permissions: ['camera', 'microphone'],
      ignoreHTTPSErrors: true,
      viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();
    const username = `bot_${Date.now()}_${botIndex}`;
    const password = `TestPassword123!`;

    // Sign up
    await page.goto('http://localhost:5173/sign-up');
    await page.fill('input[id="name"]', username);
    await page.fill('input[id="email"]', `${username}@test.com`);
    await page.fill('input[id="password"]', password);
    
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/signup/') && resp.request().method() === 'POST'),
      page.click('button:has-text("Sign Up")')
    ]);
    
    await page.waitForURL('**/sign-in');

    // Sign in
    await page.fill('input[id="username"]', username);
    await page.fill('input[id="password"]', password);
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/signin/') && resp.request().method() === 'POST'),
      page.click('button:has-text("Sign In")')
    ]);
    await page.waitForURL('**/home');

    // Join room
    await page.fill('input[placeholder="Enter meeting code"]', roomId);
    await page.click('button:has-text("Join")');
    await page.waitForTimeout(1000); // Wait for modal animation
    
    // Toggle camera and mic in pre-join
    await page.locator('button.w-12.h-6.rounded-full').nth(0).click();
    await page.waitForTimeout(500);
    await page.locator('button.w-12.h-6.rounded-full').nth(1).click();
    await page.waitForTimeout(500);

    await page.click('button:has-text("Join Call")');
    await page.waitForURL(`**/call/${roomId}`);
    await page.waitForTimeout(2000); // Let WebRTC settle

    return { page, username, context };
  };

  console.log("Spawning Bot 1...");
  const bot1 = await createBot(1);
  console.log("Spawning Bot 2...");
  const bot2 = await createBot(2);
  console.log("Spawning Bot 3...");
  const bot3 = await createBot(3);

  // Wait for all peer connections to establish
  console.log("Waiting for mesh network to settle...");
  await bot1.page.waitForTimeout(5000);

  // Actions
  console.log("Bot 1: Camera and Mic are on.");
  // Bot 1 might also check the video elements
  
  console.log("Bot 2: Opening Notes...");
  await bot2.page.click('button[title="Notes"]');
  await bot2.page.waitForTimeout(1000);
  await bot2.page.fill('textarea.notes-ta', 'Hello from Bot 2!');
  // Wait to see if it causes any re-renders
  await bot2.page.waitForTimeout(1000);

  console.log("Bot 3: Starting recording...");
  await bot3.page.click('button[title="Record meeting"]');
  await bot3.page.waitForTimeout(2000);
  
  // Take grid layout screenshots
  console.log("Taking grid layout screenshots...");
  await bot1.page.screenshot({ path: path.join(artifactDir, 'bot1_grid_view.png') });
  await bot2.page.screenshot({ path: path.join(artifactDir, 'bot2_grid_view.png') });
  await bot3.page.screenshot({ path: path.join(artifactDir, 'bot3_grid_view.png') });
  
  console.log("Bot 1: Starting screen share...");
  await bot1.page.click('button[title="Share screen"]');
  await bot1.page.waitForTimeout(3000); // Give it time to propagate across the network

  console.log("Bot 3: Sending a chat message...");
  await bot3.page.click('button[title="Chat"]');
  await bot3.page.waitForTimeout(500);
  await bot3.page.fill('input.chat-input', 'Hello from Bot 3!');
  await bot3.page.click('button.send-btn');
  await bot3.page.waitForTimeout(1000);

  console.log("Bot 2: Attempting to screen share (should be blocked)...");
  bot2.page.on('dialog', dialog => dialog.accept()); // Handle the alert
  await bot2.page.click('button[title="Share screen"]');
  await bot2.page.waitForTimeout(1000);
  
  // Take screenshots
  console.log("Taking screenshots...");
  await bot1.page.screenshot({ path: path.join(artifactDir, 'bot1_view.png') });
  await bot2.page.screenshot({ path: path.join(artifactDir, 'bot2_view.png') });
  await bot3.page.screenshot({ path: path.join(artifactDir, 'bot3_view.png') });

  // Stop recording so file downloads or saves properly (optional)
  await bot3.page.click('button[title="Stop recording"]');
  await bot3.page.waitForTimeout(1000);

  console.log("Done.");
});
