const { SESSION_PATH } = require("../config/env");
const { chromium } = require("playwright");
const path = require("path");


const EMAIL = process.env.LINKEDIN_EMAIL;
const PASSWORD = process.env.LINKEDIN_PASSWORD;

/**
 * Run this ONCE (`pnpm scrape:linkedin:login`), and again whenever the session expires.
 * It opens a real, visible browser window. If LINKEDIN_EMAIL / LINKEDIN_PASSWORD are set
 * in config.env the login form is filled in for you; otherwise log in manually.
 * Either way, complete any 2FA/CAPTCHA yourself in the window. As soon as your feed
 * loads the session is saved to linkedin-session.json, so future scrapes don't need
 * your password. Treat that file like a password and never commit it.
 */
async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("https://www.linkedin.com/login");

  if (EMAIL && PASSWORD) {
    // Best effort: LinkedIn's field ids are randomised, so find the inputs by type.
    // If this fails for any reason, just log in by hand; the session is still saved below.
    try {
      const email = page.locator('input[autocomplete^="username"]:visible, input[name="session_key"]:visible').first();
      const password = page.locator('input[type="password"]:visible').first();
      await email.fill(EMAIL, { timeout: 10000 });
      await password.fill(PASSWORD, { timeout: 5000 });
      await password.press("Enter");
      console.log("\nSubmitted your login details from config.env.");
      console.log("If LinkedIn asks for a code or CAPTCHA, finish it in the browser window.\n");
    } catch {
      if (!/linkedin\.com\/feed/.test(page.url())) {
        console.log("\nCouldn't fill the login form automatically. Please log in manually in the browser window.\n");
      }
    }
  } else {
    console.log("\nNo LINKEDIN_EMAIL / LINKEDIN_PASSWORD in config.env.");
    console.log("Log in to LinkedIn manually in the browser window that opened.\n");
  }

  // Wait (up to 5 min) until we land on the feed, i.e. logged in past any checkpoints
  try {
    await page.waitForURL(/linkedin\.com\/feed/, { timeout: 5 * 60 * 1000 });
  } catch {
    console.error("Timed out waiting for the LinkedIn feed. Login was not completed.");
    await browser.close();
    process.exit(1);
  }

  await context.storageState({ path: SESSION_PATH });
  console.log(`Logged in. Session saved to ${SESSION_PATH}`);
  console.log("You won't need to log in again until it expires. Now run: pnpm scrape:linkedin");
  await browser.close();
  process.exit(0);
}

main();
