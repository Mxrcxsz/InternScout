<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue';
import ScoreRing from './ScoreRing.vue';
import Icon from './Icon.vue';
import { SOURCE_META, BAND_LABEL, timeAgo, postedAt } from '../utils';

const props = defineProps({
  job: { type: Object, required: true },
  status: { type: String, default: null },
  api: { type: Function, required: true },
});
const emit = defineEmits(['close', 'toggle-save', 'toggle-applied']);

const description = ref(null);
const loadingDetail = ref(false);
const expanded = ref(false);

watch(
  () => props.job.url,
  async (url) => {
    description.value = null;
    expanded.value = false;
    if (!props.job.hasDescription) return;
    loadingDetail.value = true;
    try {
      const { data } = await props.api.get('/jobs/detail', { params: { url } });
      description.value = data.description;
    } catch {
      description.value = null;
    } finally {
      loadingDetail.value = false;
    }
  },
  { immediate: true }
);

const m = computed(() => props.job.match);
const source = computed(() => SOURCE_META[props.job.source] || { label: props.job.source });

// How each part of the score adds up, out of its maximum
const parts = computed(() => [
  { label: 'Role fit', value: m.value.breakdown.role, max: 50, hint: `Title reads as ${m.value.category.label}` },
  { label: 'Your skills', value: m.value.breakdown.skills, max: 30, hint: props.job.hasDescription ? `${m.value.matchedSkills.length} CV skills mentioned` : 'Estimated from title' },
  { label: 'Location', value: m.value.breakdown.location, max: 12, hint: props.job.location || 'Not stated' },
  { label: 'Level', value: Math.max(0, m.value.breakdown.level), max: 8, hint: m.value.breakdown.level >= 8 ? 'Internship' : 'Check seniority' },
]);

function onKey(e) {
  if (e.key === 'Escape') emit('close');
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="backdrop" @click="emit('close')"></div>
  <aside class="drawer" role="dialog" aria-modal="true" :aria-label="job.title">
    <header class="top">
      <div class="who">
        <span class="company">{{ job.company || 'Unknown company' }}</span>
        <h2>{{ job.title }}</h2>
      </div>
      <button class="icon-btn" aria-label="Close" @click="emit('close')"><Icon name="x" :size="18" /></button>
    </header>

    <div class="body">
      <section class="score-card" :class="m.band">
        <ScoreRing :score="m.score" :band="m.band" :size="64" />
        <div>
          <div class="band">{{ BAND_LABEL[m.band] }}</div>
          <div class="sub">How well this fits your CV</div>
        </div>
      </section>

      <section>
        <h4>Score breakdown</h4>
        <div class="bars">
          <div v-for="p in parts" :key="p.label" class="bar-row">
            <div class="bar-label">
              <span>{{ p.label }}</span>
              <span class="num">{{ p.value }}/{{ p.max }}</span>
            </div>
            <div class="bar"><div class="fill" :style="{ width: (p.value / p.max) * 100 + '%' }"></div></div>
            <div class="hint">{{ p.hint }}</div>
          </div>
          <div v-if="m.breakdown.gaps" class="bar-row penalty">
            <div class="bar-label"><span>Missing skills</span><span class="num">{{ m.breakdown.gaps }}</span></div>
          </div>
          <div v-if="m.breakdown.level < 0" class="bar-row penalty">
            <div class="bar-label"><span>Seniority / eligibility</span><span class="num">{{ m.breakdown.level }}</span></div>
          </div>
        </div>
      </section>

      <section>
        <h4>Why</h4>
        <ul class="reasons">
          <li v-for="(r, i) in m.reasons" :key="i" :class="r.kind">
            <Icon :name="r.kind === 'plus' ? 'plus' : r.kind === 'minus' ? 'minus' : 'info'" :size="14" />
            <span>{{ r.text }}</span>
          </li>
        </ul>
      </section>

      <section v-if="m.matchedSkills.length || m.gaps.length" class="skills">
        <div v-if="m.matchedSkills.length">
          <h4>Skills you have</h4>
          <div class="chips"><span v-for="s in m.matchedSkills" :key="s" class="chip have">{{ s }}</span></div>
        </div>
        <div v-if="m.gaps.length">
          <h4>They also want</h4>
          <div class="chips"><span v-for="s in m.gaps" :key="s" class="chip gap">{{ s }}</span></div>
        </div>
      </section>

      <section>
        <h4>Details</h4>
        <dl class="facts">
          <div v-if="job.location"><dt><Icon name="pin" :size="14" /></dt><dd>{{ job.location }}</dd></div>
          <div v-if="job.period"><dt><Icon name="calendar" :size="14" /></dt><dd>{{ job.period }}</dd></div>
          <div v-if="job.pay"><dt><Icon name="dollar" :size="14" /></dt><dd>{{ job.pay }}</dd></div>
          <div><dt><Icon name="clock" :size="14" /></dt><dd>Posted {{ timeAgo(postedAt(job)) }} on {{ source.label }}</dd></div>
        </dl>
      </section>

      <section v-if="job.hasDescription">
        <h4>Job description</h4>
        <p v-if="loadingDetail" class="muted">Loading…</p>
        <template v-else-if="description">
          <p class="desc" :class="{ clamp: !expanded }">{{ description }}</p>
          <button class="link-btn" @click="expanded = !expanded">{{ expanded ? 'Show less' : 'Show full description' }}</button>
        </template>
      </section>
      <p v-else class="muted">No description was scraped for this listing. Open it to see the full requirements.</p>
    </div>

    <footer class="foot">
      <button class="btn" :class="{ on: status === 'saved' }" @click="emit('toggle-save', job)">
        <Icon name="bookmark" :size="15" /> {{ status === 'saved' ? 'Saved' : 'Save' }}
      </button>
      <button class="btn" :class="{ on: status === 'applied' }" @click="emit('toggle-applied', job)">
        <Icon name="check" :size="15" /> {{ status === 'applied' ? 'Applied' : 'Mark applied' }}
      </button>
      <a class="btn primary" :href="job.url" target="_blank" rel="noopener noreferrer">
        Open listing <Icon name="external" :size="15" />
      </a>
    </footer>
  </aside>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 40;
}
.drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(520px, 100vw);
  background: var(--bg);
  border-left: 1px solid var(--border);
  box-shadow: var(--shadow);
  z-index: 50;
  display: flex;
  flex-direction: column;
  animation: slide 0.2s ease;
}
@keyframes slide {
  from { transform: translateX(24px); opacity: 0; }
}

.top {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--border);
}
.who { flex: 1; min-width: 0; }
.company { font-size: 13px; color: var(--text-muted); }
h2 { margin: 4px 0 0; font-size: 18px; line-height: 1.3; }

.icon-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px;
  cursor: pointer;
  color: var(--text-muted);
  display: grid;
}
.icon-btn:hover { color: var(--text); border-color: var(--border-strong); }

.body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
h4 {
  margin: 0 0 10px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.score-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: 10px;
  background: var(--panel);
  border: 1px solid var(--border);
}
.band { font-size: 17px; font-weight: 600; }
.score-card.strong .band { color: var(--match-strong); }
.score-card.good .band { color: var(--match-good); }
.score-card.fair .band { color: var(--match-fair); }
.sub { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

.bars { display: flex; flex-direction: column; gap: 12px; }
.bar-label {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 5px;
}
.num { font-family: var(--font-mono); font-size: 12px; color: var(--text-muted); }
.bar {
  height: 6px;
  border-radius: 3px;
  background: var(--panel-raised);
  overflow: hidden;
}
.fill {
  height: 100%;
  border-radius: 3px;
  background: var(--accent);
}
.hint { font-size: 11px; color: var(--text-dim); margin-top: 4px; }
.penalty .bar-label span:first-child { color: var(--text-muted); }
.penalty .num { color: var(--minus); }

.reasons {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.reasons li {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 13px;
  line-height: 1.45;
}
.reasons svg { flex-shrink: 0; margin-top: 2px; }
.reasons .plus svg { color: var(--plus); }
.reasons .minus svg { color: var(--minus); }
.reasons .info svg { color: var(--info); }

.skills { display: flex; flex-direction: column; gap: 16px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  font-size: 12px;
  padding: 4px 9px;
  border-radius: 6px;
  border: 1px solid var(--border);
}
.chip.have {
  color: var(--plus);
  border-color: color-mix(in srgb, var(--plus) 35%, transparent);
}
.chip.gap {
  color: var(--minus);
  border-color: color-mix(in srgb, var(--minus) 35%, transparent);
}

.facts { margin: 0; display: flex; flex-direction: column; gap: 8px; }
.facts div { display: flex; gap: 10px; align-items: flex-start; }
.facts dt { color: var(--text-dim); margin-top: 1px; }
.facts dd { margin: 0; font-size: 13px; }

.desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.65;
  color: var(--text-muted);
  white-space: pre-line;
}
.desc.clamp {
  display: -webkit-box;
  -webkit-line-clamp: 8;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.link-btn {
  background: none;
  border: none;
  padding: 0;
  margin-top: 8px;
  color: var(--accent);
  font-size: 13px;
  cursor: pointer;
}
.muted { color: var(--text-muted); font-size: 13px; margin: 0; }

.foot {
  display: flex;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--panel);
  font-size: 13px;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
}
.btn:hover { border-color: var(--border-strong); }
.btn.on { color: var(--accent); border-color: var(--accent); }
.btn.primary {
  margin-left: auto;
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-ink);
  font-weight: 600;
}
@media (max-width: 480px) {
  .foot { flex-wrap: wrap; }
  .btn.primary { margin-left: 0; flex-basis: 100%; }
  .btn { flex: 1; }
}
</style>
