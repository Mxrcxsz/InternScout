const profile = require("./profile");
const { escapeRegex } = require("../scrapers/keywords");

// Whole-word, case-insensitive matcher for a list of phrases
function matcher(patterns) {
  const rxs = patterns.map((p) => [p, new RegExp(`(^|[^a-z0-9+#.])${escapeRegex(p)}($|[^a-z0-9+#])`, "i")]);
  return (text) => {
    let longest = null;
    for (const [p, rx] of rxs) if (rx.test(text) && (!longest || p.length > longest.length)) longest = p;
    return longest;
  };
}

const ROLES = profile.roles.map((r) => ({ ...r, match: matcher(r.patterns) }));
const SKILLS = profile.skills.map((s) => ({ ...s, match: matcher(s.patterns) }));
const GAPS = profile.gapSkills.map((g) => ({ label: g, match: matcher([g]) }));
const MAX_SKILL_WEIGHT = 9; // this much matched skill weight earns full skill points

const ENTRY_LEVEL = matcher(["intern", "internship", "trainee", "traineeship", "attachment", "student", "summer", "co-op"]);
const TOO_SENIOR = matcher(["senior", "lead", "manager", "principal", "staff", "head of", "director", "phd", "full-time", "full time", "graduate programme", "experienced"]);
const FINAL_YEAR = matcher(["final year", "final-year", "penultimate", "graduating", "fresh graduate", "graduate in"]);
const REMOTE = matcher(["remote", "work from home", "hybrid"]);
const SINGAPORE = matcher(["singapore", "sg"]);

const BANDS = [
  [75, "strong"],
  [60, "good"],
  [45, "fair"],
  [0, "low"],
];

/**
 * Score a job 0-100 against your CV profile:
 *   role fit   (title vs the kinds of role you've done)   up to 50
 *   skills     (CV skills mentioned in title/description) up to 30
 *   gaps       (required skills not on your CV)          down to -10
 *   location   (Singapore best)                          up to 12
 *   level      (internship vs senior/full-time)          up to 8
 * Returns the score plus the reasons behind it, so the UI can explain it.
 */
function scoreJob(job) {
  const title = job.title || "";
  const description = job.description || "";
  const text = `${title}\n${description}`;
  const reasons = [];

  // Role fit: weighted by how specific each matched phrase is,
  // so "Embedded Software Engineer" lands between software and hardware
  const roleHits = ROLES.map((r) => ({ role: r, phrase: r.match(title) })).filter((h) => h.phrase);
  let roleFit = 0.4; // unclassified tech listing
  let category = { id: "other", label: "Other tech" };
  if (roleHits.length) {
    const total = roleHits.reduce((sum, h) => sum + h.phrase.length, 0);
    roleFit = roleHits.reduce((sum, h) => sum + h.role.fit * h.phrase.length, 0) / total;
    const primary = roleHits.reduce((a, b) => (b.phrase.length > a.phrase.length ? b : a));
    category = { id: primary.role.id, label: primary.role.label };
    // Explain using the job's own category when it suits you, else the best-fitting part of the title
    const best = primary.role.fit >= 0.6 ? primary : roleHits.reduce((a, b) => (b.role.fit > a.role.fit ? b : a));
    if (best.role.evidence && best.role.fit >= 0.6) {
      reasons.push({ kind: "plus", text: `${best.role.label} role, matching your experience (${best.role.evidence})` });
    } else if (roleFit < 0.5) {
      reasons.push({ kind: "minus", text: `${category.label} role, which isn't a focus of your CV` });
    }
  }
  const rolePoints = 50 * roleFit;

  // Skills from the CV mentioned in the listing
  const matchedSkills = SKILLS.filter((s) => s.match(text));
  const skillWeight = matchedSkills.reduce((sum, s) => sum + s.weight, 0);
  let skillPoints = 30 * Math.min(1, skillWeight / MAX_SKILL_WEIGHT);
  if (!description) {
    // Title only: give a neutral estimate based on role fit instead of punishing missing info
    skillPoints = Math.max(skillPoints, 15 * roleFit);
    reasons.push({ kind: "info", text: "Scored on the title only; open the listing to check requirements" });
  } else if (matchedSkills.length) {
    reasons.push({ kind: "plus", text: `Mentions ${matchedSkills.length} of your skills` });
  } else {
    reasons.push({ kind: "minus", text: "Description doesn't mention any of your CV skills" });
  }

  // Requirements you don't have yet
  const gaps = description ? GAPS.filter((g) => g.match(description)).map((g) => g.label) : [];
  const gapPoints = -Math.min(10, gaps.length * 2);
  if (gaps.length) reasons.push({ kind: "minus", text: `Also asks for: ${gaps.slice(0, 5).join(", ")}` });

  // Location
  const where = job.location || "";
  let locationPoints = 6; // unknown
  if (SINGAPORE(where) || job.source === "internsg") {
    locationPoints = 12;
  } else if (REMOTE(where)) {
    locationPoints = 8;
  } else if (where) {
    locationPoints = 0;
    reasons.push({ kind: "minus", text: `Based in ${where}, outside Singapore` });
  }

  // Seniority / eligibility
  let levelPoints = ENTRY_LEVEL(title) || job.source === "internsg" ? 8 : 4;
  if (TOO_SENIOR(title)) {
    levelPoints -= 20;
    reasons.push({ kind: "minus", text: "Title suggests a senior or full-time role" });
  }
  if (FINAL_YEAR(description)) {
    levelPoints -= 5;
    reasons.push({ kind: "minus", text: "Looks aimed at final-year students or graduates" });
  }

  const score = Math.round(Math.max(0, Math.min(100, rolePoints + skillPoints + gapPoints + locationPoints + levelPoints)));
  return {
    score,
    band: BANDS.find(([min]) => score >= min)[1],
    category,
    matchedSkills: matchedSkills.sort((a, b) => b.weight - a.weight).map((s) => s.label),
    gaps,
    reasons,
    breakdown: {
      role: Math.round(rolePoints),
      skills: Math.round(skillPoints),
      gaps: gapPoints,
      location: locationPoints,
      level: levelPoints,
    },
  };
}

module.exports = { scoreJob, profile };
