// Loads config.env from the backend root, regardless of where node is started from.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "config.env"), quiet: true });
