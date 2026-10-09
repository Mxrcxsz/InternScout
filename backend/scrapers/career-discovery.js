require("../config/env");
const axios = require("axios");
const cheerio = require("cheerio");
const { runStandalone } = require("../config/db");
const Job = require("../models/job-model");
const { matchTechKeywords } = require("./keywords");

// Queries designed to surface company career-page listings for tech internships,
// rather than aggregator sites already covered by other scrapers.
const DISCOVERY_QUERIES = [
  "software engineer intern Singapore 2026 site:careers.*.com",
  '"tech internship" Singapore 2026 apply careers',
  '"software engineering intern" Singapore hiring now',
  "data science intern Singapore 2026 careers page",
  "fintech internship Singapore 2026 careers apply",
];

const AGGREGATORS_TO_SKIP = ["linkedin.com", "internsg.com", "indeed.com", "glassdoor.com", "jobstreet.com", "mycareersfuture.gov.sg"];

async function serperSearch(query) {
  if (!process.env.SERPER_API_KEY) {
    console.error("[careerDiscovery] SERPER_API_KEY not set — get a free key at https://serper.dev");
    return [];
  }
  const { data } = await axios.post(
    "https://google.serper.dev/search",
    { q: query, num: 10 },
    { headers: { "X-API-KEY": process.env.SERPER_API_KEY, "Content-Type": "application/json" } }
  );
  return data.organic || [];
}

// Best-effort: pull an <h1> from the page, fall back to the search result title.
async function tryExtractTitle(url, fallbackTitle) {
  try {
    const { data: html } = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; InternSearchBot/1.0; personal use)" },
      timeout: 10000,
    });
    const $ = cheerio.load(html);
    return $("h1").first().text().trim() || fallbackTitle;
  } catch {
    return fallbackTitle;
  }
}

async function scrapeCareerPages() {
  if (!process.env.SERPER_API_KEY) {
    throw new Error("Skipped: add a free SERPER_API_KEY (https://serper.dev) to config.env to enable.");
  }
  const found = [];
  const seenUrls = new Set();

  for (const query of DISCOVERY_QUERIES) {
    let results = [];
    try {
      results = await serperSearch(query);
    } catch (err) {
      console.error(`[careerDiscovery] search failed for "${query}":`, err.message);
      continue;
    }

    for (const r of results) {
      if (!r.link || seenUrls.has(r.link)) continue;
      if (AGGREGATORS_TO_SKIP.some((domain) => r.link.includes(domain))) continue;
      seenUrls.add(r.link);

      const tags = matchTechKeywords(`${r.title || ""} ${r.snippet || ""}`);
      if (tags.length === 0) continue;

      const title = await tryExtractTitle(r.link, r.title);
      let company = null;
      try {
        company = new URL(r.link).hostname.replace("www.", "").split(".")[0];
      } catch { /* leave null */ }

      found.push({
        source: "careerpage",
        company,
        title,
        location: "Singapore",
        period: null,
        url: r.link,
        postedDate: null,
        tags,
      });
    }
  }

  const result = await Job.upsertJobs(found);
  console.log(`[careerDiscovery] found ${found.length} candidate listings, ${result.inserted} new`);
  return found;
}

module.exports = { scrapeCareerPages };

if (require.main === module) runStandalone(scrapeCareerPages);
