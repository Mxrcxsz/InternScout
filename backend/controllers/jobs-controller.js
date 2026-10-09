const fs = require("fs");
const path = require("path");
const Job = require("../models/job-model");
const { profile } = require("../matching/score");

const SESSION_PATH = path.join(__dirname, "..", "linkedin-session.json");

function toInt(value, fallback, { min = 0, max = 1000 } = {}) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

// GET /jobs?source=linkedin&search=data&category=mobile&minScore=60&sort=match|newest&limit=50&offset=0
exports.getJobs = async (req, res) => {
  try {
    const { source, search, category, sort } = req.query;
    const jobs = await Job.retrieveAll({
      source: source || undefined,
      search: search || undefined,
      category: category || undefined,
      sort: sort === "newest" ? "newest" : "match",
      minScore: toInt(req.query.minScore, 0, { max: 100 }),
      limit: toInt(req.query.limit, 1000, { min: 1 }),
      offset: toInt(req.query.offset, 0, { max: 100000 }),
    });
    res.json(jobs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error reading jobs" });
  }
};

// GET /jobs/detail?url=... -> full listing incl. description
exports.getJob = async (req, res) => {
  try {
    const job = await Job.findByUrl(req.query.url);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error reading jobs" });
  }
};

// GET /jobs/stats
exports.getStats = async (req, res) => {
  try {
    const stats = await Job.getStats();
    stats.linkedinConnected = fs.existsSync(SESSION_PATH);
    stats.careerSearchEnabled = Boolean(process.env.SERPER_API_KEY);
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error reading jobs" });
  }
};

// GET /profile -> what jobs are being matched against
exports.getProfile = (req, res) => {
  res.json({
    name: profile.name,
    headline: profile.headline,
    location: profile.location,
    skills: profile.skills.map(({ label, weight }) => ({ label, weight })),
    roles: profile.roles.map(({ id, label, fit }) => ({ id, label, fit })),
  });
};
