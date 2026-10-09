const express = require("express");

const { runAll, getStatus, setRefreshHours } = require("../scheduler");

const router = express.Router();

const ALLOWED_HOURS = [0, 6, 12, 24, 48, 168]; // 0 = manual only

// GET /scrape/status -> refresh settings, whether a run is in progress, last run results
router.get("/status", (req, res) => res.json(getStatus()));

// PUT /scrape/settings { refreshHours }
router.put("/settings", (req, res) => {
  const hours = Number(req.body?.refreshHours);
  if (!ALLOWED_HOURS.includes(hours)) {
    return res.status(400).json({ error: `refreshHours must be one of ${ALLOWED_HOURS.join(", ")}` });
  }
  setRefreshHours(hours);
  res.json(getStatus());
});

// POST /scrape/run -> start a refresh now (runs in the background)
router.post("/run", (req, res) => {
  if (getStatus().running) return res.status(409).json({ error: "A refresh is already running", ...getStatus() });
  runAll();
  res.status(202).json(getStatus());
});

module.exports = router;
