const fs = require("fs");
const path = require("path");
const { scoreJob } = require("../matching/score");
const { DATA_DIR } = require("../config/env");

// Jobs are stored in a plain JSON file (no database needed)
const DATA_FILE = path.join(DATA_DIR, "jobs.json");

function load() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

function save(jobs) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  // write to a temp file then rename, so a crash mid-write can't corrupt the data
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(jobs, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

const newest = (j) => new Date(j.postedDate || j.firstSeenAt);

// Every job with its CV match score attached. Scored on read, so profile edits apply instantly.
// Reposts of the same role (same company + title, different link) are collapsed into the newest one.
function loadScored() {
  const unique = new Map();
  for (const j of load()) {
    const key = `${(j.company || "").toLowerCase()}|${j.title.toLowerCase()}`;
    const prev = unique.get(key);
    if (!prev || newest(j) > newest(prev)) unique.set(key, j);
  }
  return [...unique.values()].map((j) => {
    const { description, ...rest } = j;
    return { ...rest, hasDescription: Boolean(description), match: scoreJob(j) };
  });
}

// CRUD / query methods
exports.retrieveAll = async function ({ source, search, category, minScore = 0, sort = "match", limit = 1000, offset = 0 } = {}) {
  let jobs = loadScored();
  if (source) jobs = jobs.filter((j) => j.source === source);
  if (category) jobs = jobs.filter((j) => j.match.category.id === category);
  if (minScore) jobs = jobs.filter((j) => j.match.score >= minScore);
  if (search) {
    const q = search.toLowerCase();
    jobs = jobs.filter((j) =>
      [j.title, j.company, j.location, ...j.match.matchedSkills].some((f) => (f || "").toLowerCase().includes(q))
    );
  }
  jobs.sort(sort === "newest" ? (a, b) => newest(b) - newest(a) : (a, b) => b.match.score - a.match.score || newest(b) - newest(a));
  return jobs.slice(offset, offset + limit);
};

exports.getStats = async function () {
  const jobs = loadScored();
  const dayAgo = Date.now() - 86400000;
  const bySource = {};
  const byCategory = {};
  let lastUpdated = null;

  for (const j of jobs) {
    const s = (bySource[j.source] ||= { source: j.source, count: 0, latest: null });
    s.count++;
    if (!s.latest || j.lastSeenAt > s.latest) s.latest = j.lastSeenAt;
    if (!lastUpdated || j.lastSeenAt > lastUpdated) lastUpdated = j.lastSeenAt;
    const c = (byCategory[j.match.category.id] ||= { ...j.match.category, count: 0 });
    c.count++;
  }

  return {
    total: jobs.length,
    newToday: jobs.filter((j) => new Date(j.firstSeenAt) > dayAgo).length,
    strongMatches: jobs.filter((j) => j.match.band === "strong").length,
    lastUpdated,
    sources: Object.values(bySource).sort((a, b) => a.source.localeCompare(b.source)),
    categories: Object.values(byCategory).sort((a, b) => b.count - a.count),
  };
};

// Full listing, including the description (for the details panel)
exports.findByUrl = async function (url) {
  const job = load().find((j) => j.url === url);
  return job ? { ...job, match: scoreJob(job) } : null;
};

exports.urlsWithDescription = async function () {
  return new Set(load().filter((j) => j.description).map((j) => j.url));
};

// Insert new listings, refresh ones we've already seen (matched on url).
exports.upsertJobs = async function (jobs) {
  if (!jobs.length) return { inserted: 0, updated: 0 };
  const now = new Date().toISOString();
  const all = load();
  const byUrl = new Map(all.map((j) => [j.url, j]));
  let inserted = 0;
  let updated = 0;

  for (const j of jobs) {
    if (!j.url || !j.title) continue;
    const fields = {
      source: j.source,
      company: j.company || null,
      title: j.title,
      location: j.location || null,
      period: j.period || null,
      url: j.url,
      postedDate: j.postedDate || null,
      tags: j.tags || [],
      lastSeenAt: now,
    };
    // Only overwrite details when this scrape actually fetched them
    if (j.description) fields.description = j.description;
    if (j.pay) fields.pay = j.pay;

    const existing = byUrl.get(j.url);
    if (existing) {
      Object.assign(existing, fields);
      updated++;
    } else {
      const job = { _id: j.url, ...fields, firstSeenAt: now };
      all.push(job);
      byUrl.set(j.url, job);
      inserted++;
    }
  }

  save(all);
  return { inserted, updated };
};
