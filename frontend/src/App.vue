<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import axios from 'axios';
import JobCard from './components/JobCard.vue';
import JobDrawer from './components/JobDrawer.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import Icon from './components/Icon.vue';
import { SOURCE_META, timeAgo, timeUntil, postedAt } from './utils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const api = axios.create({ baseURL: API_URL, timeout: 15000 });

const jobs = ref([]);
const stats = ref(null);
const profile = ref(null);
const loading = ref(true);
const errorMsg = ref('');

// Filters (applied client-side, so they're instant)
const view = ref('jobs'); // 'jobs' | 'saved' | 'applied'
const search = ref('');
const category = ref('');
const minScore = ref(0);
const source = ref('');
const sort = ref('match');
const selected = ref(null);

// ---- Saved / applied tracking, kept in this browser ----
const TRACK_KEY = 'internscout.tracking';
const THEME_KEY = 'internscout.theme';

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage unavailable; keep working in memory */ }
}

const tracking = ref(readStorage(TRACK_KEY, {}));
watch(tracking, (v) => writeStorage(TRACK_KEY, v), { deep: true });

const statusOf = (job) => tracking.value[job.url] || null;
function setStatus(job, status) {
  if (status) tracking.value[job.url] = status;
  else delete tracking.value[job.url];
}
const toggleSave = (job) => setStatus(job, statusOf(job) === 'saved' ? null : 'saved');
const toggleApplied = (job) => setStatus(job, statusOf(job) === 'applied' ? null : 'applied');

// ---- Theme ----
const theme = ref(readStorage(THEME_KEY, 'dark'));
watch(
  theme,
  (t) => {
    document.documentElement.dataset.theme = t;
    writeStorage(THEME_KEY, t);
  },
  { immediate: true }
);

// ---- Data ----
async function load() {
  loading.value = true;
  errorMsg.value = '';
  try {
    const [j, s, p] = await Promise.all([api.get('/jobs'), api.get('/jobs/stats'), api.get('/jobs/profile')]);
    jobs.value = j.data;
    stats.value = s.data;
    profile.value = p.data;
  } catch (err) {
    errorMsg.value = `Couldn't reach the backend at ${API_URL}. Is it running? Start it with "pnpm dev" in the backend folder. (${err.message})`;
  } finally {
    loading.value = false;
  }
}

// ---- Background refresh (scraping) ----
const scrapeStatus = ref(null);
const showSettings = ref(false);
const savingSettings = ref(false);
let pollTimer;

async function fetchScrapeStatus() {
  try {
    const wasRunning = Boolean(scrapeStatus.value?.running);
    const { data } = await api.get('/scrape/status');
    scrapeStatus.value = data;
    if (wasRunning && !data.running) load(); // a refresh just finished: show the new listings
  } catch { /* backend down; load() shows the error */ }
  // check often while a refresh runs, otherwise just occasionally (to catch scheduled runs)
  clearTimeout(pollTimer);
  pollTimer = setTimeout(fetchScrapeStatus, scrapeStatus.value?.running ? 4000 : 60000);
}

async function setRefreshHours(hours) {
  savingSettings.value = true;
  try {
    const { data } = await api.put('/scrape/settings', { refreshHours: hours });
    scrapeStatus.value = data;
  } finally {
    savingSettings.value = false;
  }
}

async function runNow() {
  try {
    const { data } = await api.post('/scrape/run');
    scrapeStatus.value = data;
  } catch (err) {
    if (err.response?.data) scrapeStatus.value = err.response.data;
  }
  fetchScrapeStatus();
}

const refreshLabel = computed(() => {
  const s = scrapeStatus.value;
  if (!s) return '';
  if (s.running) return `Refreshing ${SOURCE_META[s.running.current]?.label || ''}…`;
  if (!s.nextRunAt) return 'Auto-refresh off';
  return `Next refresh ${timeUntil(s.nextRunAt)}`;
});
const refreshProblem = computed(() =>
  Object.values(scrapeStatus.value?.lastRun?.results || {}).some((r) => !r.ok && !/^Skipped/.test(r.error || ''))
);

onMounted(() => {
  load();
  fetchScrapeStatus();
});
onBeforeUnmount(() => clearTimeout(pollTimer));

const counts = computed(() => {
  const values = Object.values(tracking.value);
  return {
    saved: values.filter((v) => v === 'saved').length,
    applied: values.filter((v) => v === 'applied').length,
  };
});

const newThisWeek = computed(() => {
  const weekAgo = Date.now() - 7 * 86400000;
  return jobs.value.filter((j) => new Date(postedAt(j)) > weekAgo).length;
});
const strongCount = computed(() => jobs.value.filter((j) => j.match.band === 'strong').length);
const avgTop10 = computed(() => {
  const top = jobs.value.slice().sort((a, b) => b.match.score - a.match.score).slice(0, 10);
  return top.length ? Math.round(top.reduce((s, j) => s + j.match.score, 0) / top.length) : 0;
});

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  let list = jobs.value.filter((j) => {
    const st = statusOf(j);
    if (view.value === 'saved' && st !== 'saved') return false;
    if (view.value === 'applied' && st !== 'applied') return false;
    if (category.value && j.match.category.id !== category.value) return false;
    if (source.value && j.source !== source.value) return false;
    if (j.match.score < minScore.value) return false;
    if (q) {
      const hay = [j.title, j.company, j.location, j.match.category.label, ...j.match.matchedSkills].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const time = (j) => new Date(postedAt(j)).getTime();
  return list.sort(sort.value === 'newest' ? (a, b) => time(b) - time(a) : (a, b) => b.match.score - a.match.score || time(b) - time(a));
});

const hasFilters = computed(() => search.value || category.value || source.value || minScore.value);
function clearFilters() {
  search.value = '';
  category.value = '';
  source.value = '';
  minScore.value = 0;
}
function showStrong() {
  view.value = 'jobs';
  clearFilters();
  minScore.value = 75;
  sort.value = 'match';
}

const VIEW_TITLE = {
  jobs: ['Your internship search', 'Singapore tech internships, scored against your CV.'],
  saved: ['Saved', 'Roles you bookmarked to look at properly.'],
  applied: ['Applied', 'Roles you have applied to.'],
};

const topSkills = computed(() => (profile.value?.skills || []).filter((s) => s.weight >= 3).map((s) => s.label));

// Per-source status, so it's obvious why a source has no jobs
const sourceStatus = computed(() => {
  const s = stats.value;
  if (!s) return [];
  const count = (id) => s.sources.find((x) => x.source === id)?.count || 0;
  const linkedinError = scrapeStatus.value?.lastRun?.results?.linkedin?.error;
  return [
    { id: 'internsg', ...SOURCE_META.internsg, count: count('internsg'), ok: true, note: 'IT listings, with descriptions' },
    {
      id: 'linkedin',
      ...SOURCE_META.linkedin,
      count: count('linkedin'),
      ok: s.linkedinConnected && !linkedinError,
      note: !s.linkedinConnected
        ? 'Not signed in: run pnpm scrape:linkedin:login'
        : linkedinError || 'Signed in',
    },
    {
      id: 'careerpage',
      ...SOURCE_META.careerpage,
      count: count('careerpage'),
      ok: s.careerSearchEnabled,
      note: s.careerSearchEnabled ? 'Search enabled' : 'Needs SERPER_API_KEY in config.env',
    },
  ];
});
</script>

<template>
  <div class="app">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="brand">
        <span class="logo"><Icon name="compass" :size="18" /></span>
        Intern Scout
      </div>

      <nav>
        <span class="nav-label">Discover</span>
        <button class="nav-item" :class="{ active: view === 'jobs' }" @click="view = 'jobs'">
          <Icon name="briefcase" /> Jobs <span class="count">{{ jobs.length }}</span>
        </button>
        <button class="nav-item" :class="{ active: view === 'saved' }" @click="view = 'saved'">
          <Icon name="bookmark" /> Saved <span class="count">{{ counts.saved }}</span>
        </button>
        <button class="nav-item" :class="{ active: view === 'applied' }" @click="view = 'applied'">
          <Icon name="check" /> Applied <span class="count">{{ counts.applied }}</span>
        </button>
      </nav>

      <section v-if="profile" class="side-card">
        <span class="nav-label">Matching against</span>
        <div class="profile-name"><Icon name="user" :size="14" /> {{ profile.name }}</div>
        <p class="profile-headline">{{ profile.headline }}</p>
        <div class="mini-chips">
          <span v-for="s in topSkills" :key="s">{{ s }}</span>
        </div>
        <p class="side-hint">Edit <code>backend/matching/profile.js</code> to tune scoring.</p>
      </section>

      <section v-if="sourceStatus.length" class="side-card sources">
        <span class="nav-label">Sources</span>
        <div v-for="s in sourceStatus" :key="s.id" class="source-row">
          <span class="dot" :class="{ ok: s.ok }" :style="{ '--c': s.color }"></span>
          <div>
            <div class="source-name">{{ s.label }} <span class="num">{{ s.count }}</span></div>
            <div class="source-note">{{ s.note }}</div>
          </div>
        </div>
      </section>
    </aside>

    <!-- Main -->
    <div class="main">
      <header class="topbar">
        <div class="mobile-brand"><span class="logo"><Icon name="compass" :size="16" /></span> Intern Scout</div>
        <nav class="mobile-tabs">
          <button :class="{ active: view === 'jobs' }" @click="view = 'jobs'">Jobs</button>
          <button :class="{ active: view === 'saved' }" @click="view = 'saved'">Saved {{ counts.saved || '' }}</button>
          <button :class="{ active: view === 'applied' }" @click="view = 'applied'">Applied {{ counts.applied || '' }}</button>
        </nav>
        <div class="top-actions">
          <button
            v-if="scrapeStatus"
            class="refresh-pill"
            :class="{ running: scrapeStatus.running, problem: refreshProblem && !scrapeStatus.running }"
            title="Refresh settings"
            @click="showSettings = true"
          >
            <Icon :name="refreshProblem && !scrapeStatus.running ? 'alert' : 'refresh'" :size="14" :class="{ spin: scrapeStatus.running }" />
            <span>{{ refreshLabel }}</span>
          </button>
          <button class="icon-btn" title="Settings" aria-label="Settings" @click="showSettings = true"><Icon name="settings" /></button>
          <button
            class="icon-btn"
            :title="theme === 'dark' ? 'Light mode' : 'Dark mode'"
            aria-label="Toggle theme"
            @click="theme = theme === 'dark' ? 'light' : 'dark'"
          >
            <Icon :name="theme === 'dark' ? 'sun' : 'moon'" />
          </button>
        </div>
      </header>

      <main class="content">
        <div class="page-head">
          <div>
            <h1>{{ VIEW_TITLE[view][0] }}</h1>
            <p>{{ VIEW_TITLE[view][1] }}</p>
          </div>
          <span v-if="stats?.lastUpdated" class="updated"><Icon name="clock" :size="13" /> Updated {{ timeAgo(stats.lastUpdated) }}</span>
        </div>

        <div v-if="errorMsg" class="banner error">{{ errorMsg }}</div>

        <template v-else>
          <!-- Stat tiles -->
          <div class="tiles">
            <div class="tile">
              <div class="tile-head">New this week <Icon name="sparkles" :size="14" /></div>
              <div class="tile-num">{{ newThisWeek }}</div>
              <div class="tile-sub">posted in the last 7 days</div>
            </div>
            <button class="tile clickable" @click="showStrong">
              <div class="tile-head">Strong matches <Icon name="trending" :size="14" /></div>
              <div class="tile-num strong">{{ strongCount }}</div>
              <div class="tile-sub">75%+ fit · top 10 avg {{ avgTop10 }}%</div>
            </button>
            <button class="tile clickable" @click="view = 'saved'">
              <div class="tile-head">Saved <Icon name="bookmark" :size="14" /></div>
              <div class="tile-num">{{ counts.saved }}</div>
              <div class="tile-sub">to review</div>
            </button>
            <button class="tile clickable" @click="view = 'applied'">
              <div class="tile-head">Applied <Icon name="check" :size="14" /></div>
              <div class="tile-num">{{ counts.applied }}</div>
              <div class="tile-sub">applications sent</div>
            </button>
          </div>

          <!-- Filters -->
          <div class="filters">
            <label class="search">
              <Icon name="search" />
              <input v-model="search" type="search" placeholder="Search title, company or skill" />
            </label>
            <select v-model="category" aria-label="Category">
              <option value="">All categories</option>
              <option v-for="c in stats?.categories || []" :key="c.id" :value="c.id">{{ c.label }} ({{ c.count }})</option>
            </select>
            <select v-model.number="minScore" aria-label="Minimum match">
              <option :value="0">Any match</option>
              <option :value="45">45%+ fair</option>
              <option :value="60">60%+ good</option>
              <option :value="75">75%+ strong</option>
            </select>
            <select v-model="source" aria-label="Source">
              <option value="">All sources</option>
              <option v-for="(meta, key) in SOURCE_META" :key="key" :value="key">{{ meta.label }}</option>
            </select>
            <select v-model="sort" aria-label="Sort">
              <option value="match">Best match</option>
              <option value="newest">Newest</option>
            </select>
            <span class="result-count">
              {{ filtered.length }} listing{{ filtered.length === 1 ? '' : 's' }}
              <button v-if="hasFilters" class="clear" @click="clearFilters">Clear</button>
            </span>
          </div>

          <!-- Results -->
          <p v-if="loading" class="empty">Loading listings…</p>
          <div v-else-if="filtered.length === 0" class="empty-state">
            <template v-if="jobs.length === 0">
              <h3>No listings yet</h3>
              <p>Run a scrape in the backend folder: <code>pnpm scrape:internsg</code> or <code>pnpm scrape:all</code>, then reload.</p>
            </template>
            <template v-else-if="view === 'saved' && !hasFilters">
              <h3>Nothing saved yet</h3>
              <p>Hit <strong>Save</strong> on any listing to keep it here.</p>
            </template>
            <template v-else-if="view === 'applied' && !hasFilters">
              <h3>No applications tracked</h3>
              <p>Use <strong>Mark applied</strong> on a listing once you've sent your application.</p>
            </template>
            <template v-else>
              <h3>No listings match these filters</h3>
              <p><button class="link" @click="clearFilters">Clear filters</button></p>
            </template>
          </div>

          <div v-else class="grid">
            <JobCard
              v-for="job in filtered"
              :key="job.url"
              :job="job"
              :status="statusOf(job)"
              @open="selected = job"
              @toggle-save="toggleSave"
              @toggle-applied="toggleApplied"
            />
          </div>
        </template>
      </main>
    </div>

    <SettingsPanel
      v-if="showSettings"
      :status="scrapeStatus"
      :saving="savingSettings"
      @close="showSettings = false"
      @set-hours="setRefreshHours"
      @run-now="runNow"
    />

    <JobDrawer
      v-if="selected"
      :job="selected"
      :status="statusOf(selected)"
      :api="api"
      @close="selected = null"
      @toggle-save="toggleSave"
      @toggle-applied="toggleApplied"
    />
  </div>
</template>

<style scoped>
.app {
  display: grid;
  grid-template-columns: 248px 1fr;
  min-height: 100%;
}

/* ---- Sidebar ---- */
.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  background: var(--sidebar);
  border-right: 1px solid var(--border);
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.brand, .mobile-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 15px;
  padding: 2px 8px;
}
.logo {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}
.nav-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-dim);
  padding: 0 8px 6px;
}
.sidebar nav { display: flex; flex-direction: column; gap: 2px; }
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: 7px;
  background: none;
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
}
.nav-item:hover { background: var(--panel-hover); color: var(--text); }
.nav-item.active { background: var(--panel-raised); color: var(--text); }
.nav-item .count {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-dim);
}

.side-card {
  border-top: 1px solid var(--border);
  padding: 16px 8px 0;
}
.side-card .nav-label { padding: 0 0 8px; }
.profile-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}
.profile-headline {
  margin: 4px 0 10px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.45;
}
.mini-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.mini-chips span {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 5px;
  background: var(--panel-raised);
  color: var(--text-muted);
}
.side-hint {
  margin: 10px 0 0;
  font-size: 11px;
  color: var(--text-dim);
  line-height: 1.5;
}
code {
  font-family: var(--font-mono);
  font-size: 0.92em;
  background: var(--panel-raised);
  padding: 1px 5px;
  border-radius: 4px;
}

.sources { margin-top: auto; display: flex; flex-direction: column; gap: 10px; }
.source-row { display: flex; gap: 10px; align-items: flex-start; }
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;
  border: 1.5px solid var(--text-dim);
}
.dot.ok { background: var(--c); border-color: var(--c); }
.source-name { font-size: 13px; font-weight: 500; }
.source-name .num { font-family: var(--font-mono); font-size: 12px; color: var(--text-dim); margin-left: 4px; }
.source-note { font-size: 11px; color: var(--text-dim); line-height: 1.45; }

/* ---- Main ---- */
.main { min-width: 0; display: flex; flex-direction: column; }
.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 56px;
  padding: 0 24px;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
}
.mobile-brand, .mobile-tabs { display: none; }
.top-actions { margin-left: auto; display: flex; gap: 6px; }
.icon-btn {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text-muted);
  cursor: pointer;
}
.icon-btn:hover { color: var(--text); border-color: var(--border-strong); }
.refresh-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.refresh-pill:hover { color: var(--text); border-color: var(--border-strong); }
.refresh-pill.running { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, transparent); }
.refresh-pill.problem { color: var(--minus); border-color: color-mix(in srgb, var(--minus) 40%, transparent); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 560px) {
  .refresh-pill span { display: none; }
  .refresh-pill { padding: 0 10px; }
}

.content {
  width: 100%;
  max-width: 1160px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}
.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}
h1 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.01em; }
.page-head p { margin: 4px 0 0; color: var(--text-muted); }
.updated {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}

.banner {
  padding: 14px 16px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.5;
}
.banner.error {
  color: var(--minus);
  background: color-mix(in srgb, var(--minus) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--minus) 30%, transparent);
}

.tiles {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}
.tile {
  text-align: left;
  padding: 16px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--panel);
}
.tile.clickable { cursor: pointer; }
.tile.clickable:hover { border-color: var(--border-strong); background: var(--panel-hover); }
.tile-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.tile-head svg { color: var(--text-dim); }
.tile-num {
  margin-top: 8px;
  font-size: 28px;
  font-weight: 700;
  font-family: var(--font-mono);
}
.tile-num.strong { color: var(--match-strong); }
.tile-sub { font-size: 12px; color: var(--text-dim); margin-top: 2px; }

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
}
.search {
  flex: 1 1 260px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 38px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text-dim);
}
.search:focus-within { border-color: var(--accent); }
.search input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: none;
  color: var(--text);
  font: inherit;
}
.search input::placeholder { color: var(--text-dim); }
select {
  height: 38px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  max-width: 100%;
}
select:hover { border-color: var(--border-strong); }
.result-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}
.clear, .link {
  background: none;
  border: none;
  padding: 0;
  margin-left: 8px;
  color: var(--accent);
  cursor: pointer;
  font-size: inherit;
}
.link { margin: 0; }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 12px;
}

.empty { color: var(--text-muted); }
.empty-state {
  text-align: center;
  padding: 56px 16px;
  border: 1px dashed var(--border);
  border-radius: 10px;
}
.empty-state h3 { margin: 0 0 6px; font-size: 16px; }
.empty-state p { margin: 0; color: var(--text-muted); }

/* ---- Responsive ---- */
@media (max-width: 1000px) {
  .tiles { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 860px) {
  .app { grid-template-columns: 1fr; }
  .sidebar { display: none; }
  .mobile-brand { display: flex; padding: 0; }
  .mobile-tabs { display: flex; gap: 4px; }
  .mobile-tabs button {
    border: none;
    background: none;
    padding: 6px 10px;
    border-radius: 7px;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 13px;
  }
  .mobile-tabs button.active { background: var(--panel-raised); color: var(--text); }
  .topbar { padding: 0 16px; }
  .content { padding: 24px 16px 48px; }
  .grid { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .mobile-brand { display: none; }
  .page-head { flex-direction: column; align-items: flex-start; gap: 6px; }
  .filters select { flex: 1 1 calc(50% - 4px); }
  .result-count { margin-left: 0; }
}
</style>
