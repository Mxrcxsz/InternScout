// Your profile, built from your CV. Every job is scored against this.
// Edit freely: change `fit` to say how much you want a kind of role (0-1),
// and add skills as you pick them up. Changes apply on the next page load, no rescrape needed.

module.exports = {
  name: "Marcus Yeong",
  headline: "SMU Information Systems · iOS, full-stack web & automation",
  location: "Singapore",

  // Kinds of role, checked against the job title. `fit` = how well it suits your background.
  roles: [
    { id: "mobile", label: "Mobile / iOS", fit: 1.0, patterns: ["ios", "swift", "mobile", "android", "app developer", "mobile app"], evidence: "OCBC: iOS banking app + SwiftUI rewrite" },
    { id: "fullstack", label: "Full-stack / Web", fit: 0.95, patterns: ["full stack", "full-stack", "fullstack", "web developer", "web application", "web development", "web engineer"], evidence: "Rubify (Rails) and KoreFit (Node.js)" },
    { id: "swe", label: "Software Engineering", fit: 0.9, patterns: ["software", "developer", "programmer", "sde", "swe", "application development", "applications developer", "application developer"], evidence: "3 dev roles + a live client project" },
    { id: "backend", label: "Backend", fit: 0.9, patterns: ["backend", "back-end", "back end", "api"], evidence: "KoreFit: REST APIs, booking + finance logic" },
    { id: "automation", label: "Automation / RPA", fit: 0.9, patterns: ["automation", "rpa", "power automate", "power platform", "low-code", "process improvement"], evidence: "AIA: Power Automate mass-email workflow" },
    { id: "frontend", label: "Frontend", fit: 0.85, patterns: ["frontend", "front-end", "front end", "ui engineer", "ui developer"], evidence: "Rubify: pagination + data display components" },
    { id: "digital", label: "Digital / IT", fit: 0.75, patterns: ["digital", "it", "information technology", "enterprise applications", "information systems", "technology", "tech"], evidence: "AIA Digital Analytics & Automation; IS degree" },
    { id: "product", label: "Product / Business Analysis", fit: 0.65, patterns: ["product", "business analyst", "business analysis", "solutions", "project"], evidence: "AIA: iPOS+ rollout to 6,000+ agents" },
    { id: "data", label: "Data / Analytics", fit: 0.6, patterns: ["data analyst", "analytics", "data", "business intelligence", "bi"], evidence: "AIA analytics role" },
    { id: "qa", label: "QA / Testing", fit: 0.55, patterns: ["qa", "quality assurance", "test", "tester"], evidence: "OCBC: tracing + fixing production crashes" },
    { id: "cloud", label: "Cloud / DevOps", fit: 0.5, patterns: ["devops", "cloud", "sre", "infrastructure", "platform engineer"], evidence: null },
    { id: "ai", label: "AI / ML", fit: 0.45, patterns: ["machine learning", "ml", "ai", "artificial intelligence", "data science", "data scientist", "deep learning", "llm", "computer vision", "nlp"], evidence: null },
    { id: "security", label: "Cybersecurity", fit: 0.35, patterns: ["security", "cyber", "cybersecurity", "infosec", "soc"], evidence: null },
    { id: "hardware", label: "Hardware / Embedded", fit: 0.15, patterns: ["embedded", "hardware", "firmware", "electrical", "electronic", "mechanical", "rtl", "asic", "cad", "semiconductor", "fpga"], evidence: null },
  ],

  // Skills from your CV, checked against the title + description. weight 3 = core strength.
  skills: [
    { label: "iOS", weight: 3, patterns: ["ios"] },
    { label: "Swift / SwiftUI", weight: 3, patterns: ["swift", "swiftui"] },
    { label: "Mobile apps", weight: 2, patterns: ["mobile", "mobile app", "mobile application"] },
    { label: "MVVM", weight: 1, patterns: ["mvvm"] },
    { label: "Firebase", weight: 1, patterns: ["firebase", "crashlytics"] },
    { label: "Android", weight: 1, patterns: ["android"] },
    { label: "Node.js", weight: 3, patterns: ["node", "node.js", "nodejs"] },
    { label: "Express", weight: 1, patterns: ["express.js", "expressjs"] },
    { label: "REST APIs", weight: 3, patterns: ["restful", "rest api", "rest apis", "api", "apis"] },
    { label: "JavaScript", weight: 2, patterns: ["javascript", "js", "typescript"] },
    { label: "Vue", weight: 1, patterns: ["vue", "vue.js", "vuejs"] },
    { label: "Ruby on Rails", weight: 2, patterns: ["ruby", "rails", "ruby on rails"] },
    { label: "OAuth / Auth", weight: 1, patterns: ["oauth", "authentication", "sso"] },
    { label: "Full-stack", weight: 2, patterns: ["full stack", "full-stack", "fullstack"] },
    { label: "Web development", weight: 2, patterns: ["web development", "web application", "web applications", "web app", "html", "css"] },
    { label: "MongoDB", weight: 1, patterns: ["mongodb", "mongo", "nosql"] },
    { label: "Power Automate", weight: 3, patterns: ["power automate", "power platform", "power apps", "powerapps"] },
    { label: "Process automation", weight: 2, patterns: ["automation", "automate", "rpa", "workflow", "workflows"] },
    { label: "Excel / VBA", weight: 2, patterns: ["vba", "excel", "macros"] },
    { label: "SharePoint", weight: 2, patterns: ["sharepoint", "microsoft 365", "office 365"] },
    { label: "Debugging", weight: 1, patterns: ["debugging", "debug", "troubleshooting", "troubleshoot"] },
    { label: "Documentation", weight: 1, patterns: ["documentation", "knowledge base"] },
    { label: "Stakeholder support", weight: 1, patterns: ["user support", "onboarding", "training users", "end users", "end-users"] },
  ],

  // Common requirements NOT on your CV, shown as gaps so you know what a role expects.
  gapSkills: [
    "Python", "Java", "C++", "C#", ".NET", "Golang", "Kotlin", "SQL", "React", "Angular", "Flutter",
    "React Native", "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Linux", "Tableau", "Power BI",
    "Spring", "Django", "PHP", "TensorFlow", "PyTorch", "Machine Learning", "Salesforce", "SAP",
  ],
};
