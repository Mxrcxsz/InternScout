require("./config/env");
const fs = require("fs");
const path = require("path");
const { runStandalone } = require("./config/db");
const { scrapeInternSG } = require("./scrapers/internsg");
const { scrapeLinkedIn } = require("./scrapers/linkedin");
const { scrapeCareerPages } = require("./scrapers/career-discovery");

// Refresh settings + the outcome of the last run, kept across restarts
const STATE_FILE = path.join(__dirname, "data", "scheduler.json");
const CHECK_EVERY_MS = 10 * 60 * 1000; // how often we check whether a refresh is due
const DEFAULT_HOURS = parseFloat(process.env.REFRESH_EVERY_HOURS || "24");

const SCRAPERS = [
  { id: "internsg", run: scrapeInternSG },
  { id: "careerpage", run: scrapeCareerPages },
  // LinkedIn last; it's the slowest
  { id: "linkedin", run: scrapeLinkedIn },
];

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

const state = {
  refreshHours: DEFAULT_HOURS, // 0 = manual only
  lastRun: null, // { startedAt, finishedAt, results: { [source]: { ok, count, error } } }
  ...loadState(),
  running: null, // { startedAt, current } while a run is in progress (never persisted)
};

// No run recorded yet (first start): treat the newest scraped job as the last run,
// so existing data doesn't trigger an immediate full refresh
if (!state.lastRun) {
  try {
    const jobs = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "jobs.json"), "utf8"));
    const latest = jobs.reduce((max, j) => (j.lastSeenAt > max ? j.lastSeenAt : max), "");
    if (latest) state.lastRun = { startedAt: latest, finishedAt: latest, results: {} };
  } catch { /* no data yet: first refresh runs right away */ }
}

function saveState() {
  const { running, ...persisted } = state;
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(persisted, null, 2));
}

function nextRunAt() {
  if (!state.refreshHours) return null;
  if (!state.lastRun?.startedAt) return new Date().toISOString();
  return new Date(new Date(state.lastRun.startedAt).getTime() + state.refreshHours * 3600000).toISOString();
}

async function runAll() {
  if (state.running) return false;
  const startedAt = new Date().toISOString();
  state.running = { startedAt, current: null };
  const results = {};
  console.log(`\n[scheduler] run started at ${startedAt}`);

  for (const { id, run } of SCRAPERS) {
    state.running.current = id;
    try {
      const jobs = await run();
      results[id] = { ok: true, count: jobs.length };
    } catch (e) {
      console.error(`[scheduler] ${id} failed:`, e.message);
      results[id] = { ok: false, count: 0, error: e.message };
    }
  }

  state.lastRun = { startedAt, finishedAt: new Date().toISOString(), results };
  state.running = null;
  saveState();
  console.log(`[scheduler] run finished at ${state.lastRun.finishedAt}\n`);
  return true;
}

function refreshIfDue() {
  const next = nextRunAt();
  if (next && new Date(next) <= new Date()) runAll();
}

function startScheduler() {
  // Check shortly after startup (catches up if the backend was off when a refresh was due), then periodically
  setTimeout(refreshIfDue, 15000);
  setInterval(refreshIfDue, CHECK_EVERY_MS);
  console.log(
    state.refreshHours
      ? `[scheduler] auto-refresh every ${state.refreshHours}h, next at ${nextRunAt()}`
      : "[scheduler] auto-refresh off (manual only)"
  );
}

function getStatus() {
  return {
    refreshHours: state.refreshHours,
    running: state.running,
    lastRun: state.lastRun,
    nextRunAt: nextRunAt(),
  };
}

function setRefreshHours(hours) {
  state.refreshHours = hours;
  saveState();
  console.log(`[scheduler] auto-refresh set to ${hours ? `every ${hours}h` : "off"}`);
}

module.exports = { startScheduler, runAll, getStatus, setRefreshHours };

// `pnpm scrape:all` -> run once now instead of waiting for the next refresh
if (require.main === module) runStandalone(runAll);
