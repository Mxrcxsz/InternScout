// Keywords used to decide whether a listing counts as a "tech" internship.
// Tune this list freely — it's the single place that controls filtering.
const TECH_KEYWORDS = [
  "software", "engineer", "engineering", "developer", "programming",
  "full stack", "fullstack", "full-stack", "front end", "frontend", "front-end",
  "back end", "backend", "back-end", "web",
  "data", "data science", "data analyst", "data engineer", "machine learning",
  "ml", "ai", "artificial intelligence", "deep learning", "llm",
  "devops", "cloud", "aws", "azure", "gcp", "infrastructure",
  "cyber", "security", "cybersecurity", "infosec",
  "mobile", "ios", "android", "swift", "kotlin",
  "automation", "rpa", "power automate",
  "fintech", "quant", "blockchain", "product manager", "product management",
  "ux", "ui", "ui/ux",
  "it", "information technology", "digital", "database", "sql", "api",
  "python", "java", "javascript", "node", "react", "vue", "angular",
  "systems", "network", "qa", "quality assurance", "test engineer", "tech", "technology",
];

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole-word match, so "ai" doesn't match "maintain" and "it" doesn't match "Intern/TS"
const PATTERNS = TECH_KEYWORDS.map((kw) => [kw, new RegExp(`(^|[^a-z0-9])${escapeRegex(kw)}($|[^a-z0-9])`, "i")]);

// Returns the matched keywords for a title/description. Empty array = not a tech listing.
function matchTechKeywords(text) {
  if (!text) return [];
  return PATTERNS.filter(([, rx]) => rx.test(text)).map(([kw]) => kw);
}

module.exports = { TECH_KEYWORDS, matchTechKeywords, escapeRegex };
