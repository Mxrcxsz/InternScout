require("../config/env");
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const { runStandalone } = require("../config/db");
const Job = require("../models/job-model");
const { matchTechKeywords } = require("./keywords");

const SESSION_PATH = path.join(__dirname, "..", "linkedin-session.json");

const KEYWORDS = (process.env.LINKEDIN_SEARCH_KEYWORDS || "software engineer intern")
  .split(",").map((s) => s.trim()).filter(Boolean);
const LOCATION = process.env.LINKEDIN_LOCATION || "Singapore";
const MAX_PAGES = parseInt(process.env.LINKEDIN_MAX_PAGES || "2", 10); // 25 results per page
const MAX_DETAILS = parseInt(process.env.LINKEDIN_MAX_DETAILS || "60", 10); // descriptions fetched per run

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (min, max) => sleep(min + Math.random() * (max - min));

// The results list lazy-renders cards, so scroll its container to the bottom like a person would
async function scrollResults(page) {
  await page.evaluate(async () => {
    const first = document.querySelector("li[data-occludable-job-id]");
    let list = first;
    while (list && !(list.scrollHeight > list.clientHeight + 20 && getComputedStyle(list).overflowY !== "visible")) {
      list = list.parentElement;
    }
    if (!list) return;
    for (let y = 0; y <= list.scrollHeight; y += 300 + Math.random() * 200) {
      list.scrollTop = y;
      await new Promise((r) => setTimeout(r, 250 + Math.random() * 250));
    }
  });
}

function readCards(page) {
  return page.$$eval("li[data-occludable-job-id]", (items) =>
    items.map((li) => {
      const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : null);
      const link = li.querySelector("a.job-card-list__title--link");
      const title = text(link && link.querySelector("strong")) || (link?.getAttribute("aria-label") || "").replace(/ with verification$/, "");
      return {
        id: li.getAttribute("data-occludable-job-id"),
        title: title.trim(),
        company: text(li.querySelector(".artdeco-entity-lockup__subtitle")),
        location: text(li.querySelector(".job-card-container__metadata-wrapper li")),
        posted: li.querySelector("time")?.getAttribute("datetime") || null,
      };
    })
  );
}

// Click a card and read its description from the right-hand pane
async function readDescription(page, id) {
  const card = page.locator(`li[data-occludable-job-id="${id}"] .job-card-container`);
  const alreadyOpen = await card.evaluate((el) => el.getAttribute("aria-current") === "page").catch(() => false);
  if (!alreadyOpen) {
    const before = await page.locator("#job-details").first().textContent().catch(() => "");
    await card.locator("a.job-card-list__title--link").click({ timeout: 10000 });
    await page.waitForFunction(
      (prev) => {
        const el = document.querySelector("#job-details");
        return el && el.textContent.trim() && el.textContent !== prev;
      },
      before,
      { timeout: 10000 }
    );
  }
  const text = await page.locator("#job-details").first().innerText();
  return text.replace(/^\s*About the job\s*/i, "").trim().slice(0, 6000);
}

/**
 * IMPORTANT: automated scraping of LinkedIn's logged-in pages breaks their Terms of
 * Service, even with your own account. Their bot detection can suspend accounts for
 * this. The pacing below reduces, but does not eliminate, that risk. Keep it to
 * once a day, not a tight loop.
 */
async function scrapeLinkedIn() {
  if (!fs.existsSync(SESSION_PATH)) {
    throw new Error("Not signed in. Run `pnpm scrape:linkedin:login` once.");
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: SESSION_PATH, viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  const known = await Job.urlsWithDescription();
  const jobs = new Map();
  let detailsLeft = MAX_DETAILS;
  let expired = false;

  for (const keyword of KEYWORDS) {
    for (let p = 0; p < MAX_PAGES && !expired; p++) {
      const searchUrl =
        `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}` +
        `&location=${encodeURIComponent(LOCATION)}&f_JT=I${p ? `&start=${p * 25}` : ""}`; // f_JT=I -> internship filter
      try {
        await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await jitter(3000, 5000);

        if (/\/(login|authwall|checkpoint|uas\/login)/.test(page.url())) {
          expired = true;
          break;
        }

        await scrollResults(page);
        const cards = (await readCards(page)).filter((c) => c.id && c.title);
        console.log(`[linkedin] "${keyword}" page ${p + 1}: ${cards.length} cards`);
        if (cards.length === 0) break;

        for (const card of cards) {
          const url = `https://www.linkedin.com/jobs/view/${card.id}/`;
          if (jobs.has(url)) continue;
          const job = {
            source: "linkedin",
            company: card.company,
            title: card.title,
            location: card.location || LOCATION,
            period: null,
            url,
            postedDate: card.posted ? new Date(card.posted).toISOString() : null,
          };

          if (!known.has(url) && detailsLeft > 0) {
            try {
              job.description = await readDescription(page, card.id);
              detailsLeft--;
              await jitter(1200, 2500);
            } catch (err) {
              console.error(`[linkedin] couldn't read description for "${card.title}":`, err.message);
            }
          }

          job.tags = matchTechKeywords(`${job.title} ${job.description || ""}`);
          jobs.set(url, job);
        }
        if (cards.length < 25) break; // last page of results
      } catch (err) {
        console.error(`[linkedin] search for "${keyword}" page ${p + 1} failed:`, err.message);
        break;
      }

      await jitter(4000, 7000); // pause between result pages
    }
  }

  await browser.close();
  if (expired) throw new Error("Session expired. Run `pnpm scrape:linkedin:login` again.");

  // Keep tech roles only (the searches are already targeted, this drops the odd stray)
  const techJobs = [...jobs.values()].filter((j) => j.tags.length > 0);
  const result = await Job.upsertJobs(techJobs);
  console.log(`[linkedin] scraped ${jobs.size} listings, ${techJobs.length} tech-related, ${result.inserted} new`);
  return techJobs;
}

module.exports = { scrapeLinkedIn };

if (require.main === module) runStandalone(scrapeLinkedIn);
