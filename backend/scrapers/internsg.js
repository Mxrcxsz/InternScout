require("../config/env");
const axios = require("axios");
const cheerio = require("cheerio");
const { runStandalone } = require("../config/db");
const Job = require("../models/job-model");
const { matchTechKeywords } = require("./keywords");

const BASE = "https://www.internsg.com";
const MAX_PAGES = parseInt(process.env.INTERNSG_MAX_PAGES || "6", 10);
const IT_PROFESSION = 107; // InternSG's "IT / Information Technology" filter
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; InternSearchBot/1.0; personal use)" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (text) => (text || "").replace(/\s+/g, " ").trim();

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// "01 Oct" -> ISO date. The year isn't shown, so assume the most recent past occurrence.
function parseListedDate(text) {
  const m = clean(text).match(/^(\d{1,2})\s+([A-Za-z]{3})/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[2].toLowerCase());
  if (month < 0) return null;
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), month, parseInt(m[1], 10)));
  if (d - now > 2 * 86400000) d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString();
}

/**
 * Each listing is an <a class="job-listing-row"> with the title, company, location,
 * period and listed date in their own elements. If the site's markup changes and this
 * stops finding rows, that's the first thing to check.
 */
function parsePage(html) {
  const $ = cheerio.load(html);
  const rows = [];

  $("a.job-listing-row").each((_, el) => {
    const $row = $(el);
    const href = $row.attr("href");
    const title = clean($row.find(".job-listing-title").text()).replace(/⭐/g, "").trim();
    if (!href || !title) return;
    if (/closed/i.test($row.find(".ast-col-lg-1").text())) return; // no longer taking applications

    const $company = $row.find(".job-listing-company").clone();
    $company.find(".badge").remove();
    const dts = $row.find(".job-listing-dt").map((_, d) => clean($(d).text())).get();
    const url = new URL(href, BASE);
    url.search = "";

    rows.push({
      source: "internsg",
      company: clean($company.text()) || null,
      title,
      location: dts[0] || null,
      period: dts[1] || null,
      url: url.toString(),
      postedDate: parseListedDate($row.find(".badge-success").text()),
    });
  });

  return rows;
}

// Pull the job description and pay from a listing's detail page
async function fetchDetails(url) {
  const { data: html } = await axios.get(url, { headers: HEADERS, timeout: 15000 });
  const $ = cheerio.load(html);
  let description = null;
  $(".isg-field-card").each((_, el) => {
    const text = clean($(el).text());
    if (/^Job Description/i.test(text)) description = text.replace(/^Job Description\s*/i, "");
  });
  return {
    description: description ? description.slice(0, 6000) : null,
    pay: clean($(".isg-job-pay").first().text()) || null,
  };
}

async function scrapeInternSG() {
  const allRows = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? `${BASE}/jobs/?f_p=${IT_PROFESSION}` : `${BASE}/jobs/${page}?f_p=${IT_PROFESSION}`;
    try {
      const { data: html } = await axios.get(url, { headers: HEADERS, timeout: 15000 });
      const rows = parsePage(html);
      if (rows.length === 0) break; // ran past the last page
      allRows.push(...rows);
    } catch (err) {
      console.error(`[internsg] failed to fetch page ${page}:`, err.message);
      break;
    }
  }

  // Dedup by url
  const jobs = [...new Map(allRows.map((r) => [r.url, r])).values()];

  // Fetch descriptions only for listings we haven't already got one for
  const known = await Job.urlsWithDescription();
  const toFetch = jobs.filter((j) => !known.has(j.url));
  console.log(`[internsg] ${jobs.length} listings, fetching details for ${toFetch.length} new ones...`);
  for (let i = 0; i < toFetch.length; i += 4) {
    await Promise.all(
      toFetch.slice(i, i + 4).map(async (job) => {
        try {
          Object.assign(job, await fetchDetails(job.url));
        } catch (err) {
          console.error(`[internsg] details failed for ${job.url}:`, err.message);
        }
      })
    );
    await sleep(500); // be polite
  }

  for (const job of jobs) {
    job.tags = matchTechKeywords(`${job.title} ${job.description || ""}`);
  }

  const result = await Job.upsertJobs(jobs);
  console.log(`[internsg] scraped ${jobs.length} IT listings, ${result.inserted} new`);
  return jobs;
}

module.exports = { scrapeInternSG };

if (require.main === module) runStandalone(scrapeInternSG);
