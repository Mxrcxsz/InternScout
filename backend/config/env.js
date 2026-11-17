// Loads config.env from the backend root, regardless of where node is started from.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "config.env"), quiet: true });

const ROOT = path.join(__dirname, "..");

// Where jobs.json / scheduler.json live. On Render, point this at the persistent disk.
const DATA_DIR = path.resolve(ROOT, process.env.DATA_DIR || "data");
// LinkedIn login session. On Render, upload it as a Secret File and point this at /etc/secrets/...
const SESSION_PATH = path.resolve(ROOT, process.env.LINKEDIN_SESSION_PATH || "linkedin-session.json");

module.exports = { DATA_DIR, SESSION_PATH };
