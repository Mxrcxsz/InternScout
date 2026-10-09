const express = require("express");

const jobsController = require("../controllers/jobs-controller");

const router = express.Router(); // sub application

router.get("/", jobsController.getJobs);

router.get("/stats", jobsController.getStats);

router.get("/detail", jobsController.getJob);

router.get("/profile", jobsController.getProfile);

// EXPORT
module.exports = router;
