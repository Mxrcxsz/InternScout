require("./config/env");
const express = require("express");
const cors = require("cors");

const jobsRoutes = require("./routes/jobs-routes");
const scrapeRoutes = require("./routes/scrape-routes");
const { startScheduler } = require("./scheduler");

const server = express();

// Enable CORS for localhost, plus an optional deployed frontend (FRONTEND_ORIGIN)
const allowedLocalhost = /^http:\/\/localhost(:\d+)?$/;
const allowed127 = /^http:\/\/127\.0\.0\.1(:\d+)?$/;
// FRONTEND_ORIGIN may be a comma-separated list, e.g. "https://intern-scout.vercel.app,https://my-domain.com"
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);
server.use(
  cors({
    origin: (origin, callback) => {
      // allow non-browser tools like Postman/curl (no Origin header)
      if (!origin) return callback(null, true);
      if (allowedLocalhost.test(origin) || allowed127.test(origin) || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "OPTIONS"],
    credentials: false,
  })
);

server.use(express.json());

// root routes
server.use("/jobs", jobsRoutes);
server.use("/scrape", scrapeRoutes);
server.get("/health", (req, res) => res.json({ ok: true }));

server.use((err, req, res, next) => {
  console.error(err.message);
  res.status(err.message === "Not allowed by CORS" ? 403 : 500).json({ error: err.message });
});

function startServer() {
  // Hosts like Render/Railway need 0.0.0.0; locally stay on localhost unless HOST is set
  const hostname = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "localhost");
  const port = process.env.PORT || 8000;

  server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
    startScheduler();
  });
}

// start the web server + daily scrape schedule
startServer();
