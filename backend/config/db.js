require("./env");

// No database: jobs live in data/jobs.json (see models/job-model.js).

// Used by the scrape scripts when run directly (e.g. `pnpm scrape:internsg`)
async function runStandalone(fn) {
  try {
    await fn();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  process.exit(0);
}

module.exports = { runStandalone };
