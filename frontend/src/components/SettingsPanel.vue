<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue';
import Icon from './Icon.vue';
import { SOURCE_META, REFRESH_OPTIONS, timeAgo, timeUntil } from '../utils';

const props = defineProps({
  status: { type: Object, default: null },
  saving: { type: Boolean, default: false },
});
const emit = defineEmits(['close', 'set-hours', 'run-now']);

const running = computed(() => props.status?.running);
const results = computed(() => props.status?.lastRun?.results || {});

function onKey(e) {
  if (e.key === 'Escape') emit('close');
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="backdrop" @click="emit('close')"></div>
  <aside class="panel" role="dialog" aria-modal="true" aria-label="Settings">
    <header class="top">
      <h2>Settings</h2>
      <button class="icon-btn" aria-label="Close" @click="emit('close')"><Icon name="x" :size="18" /></button>
    </header>

    <div v-if="!status" class="body"><p class="muted">Loading…</p></div>
    <div v-else class="body">
      <section>
        <h4>Auto-refresh</h4>
        <p class="help">How often to scrape InternSG, LinkedIn and career pages for new listings.</p>
        <div class="segmented" role="radiogroup" aria-label="Refresh interval">
          <button
            v-for="o in REFRESH_OPTIONS"
            :key="o.hours"
            role="radio"
            :aria-checked="status.refreshHours === o.hours"
            :class="{ active: status.refreshHours === o.hours }"
            :disabled="saving"
            @click="emit('set-hours', o.hours)"
          >{{ o.label }}</button>
        </div>
        <p class="help small">
          Refreshes run in the background while the backend (<code>pnpm dev</code>) is running.
          If it was off when one was due, it catches up a few seconds after starting.
        </p>
      </section>

      <section class="status-card">
        <div class="row">
          <span class="label">Last refresh</span>
          <span>{{ status.lastRun ? timeAgo(status.lastRun.finishedAt) : 'Never' }}</span>
        </div>
        <div class="row">
          <span class="label">Next refresh</span>
          <span v-if="running">Running now</span>
          <span v-else-if="status.nextRunAt">{{ timeUntil(status.nextRunAt) }}</span>
          <span v-else>Off, manual only</span>
        </div>
        <button class="btn primary" :disabled="Boolean(running)" @click="emit('run-now')">
          <Icon name="refresh" :size="15" :class="{ spin: running }" />
          <template v-if="running">Refreshing {{ SOURCE_META[running.current]?.label || '' }}…</template>
          <template v-else>Refresh now</template>
        </button>
        <p class="help small">A full refresh takes about 5 minutes. LinkedIn reads up to 60 new job descriptions per run.</p>
      </section>

      <section v-if="Object.keys(results).length">
        <h4>Last refresh results</h4>
        <ul class="results">
          <li v-for="(r, id) in results" :key="id">
            <Icon :name="r.ok ? 'check' : 'alert'" :size="15" :class="r.ok ? 'ok' : 'bad'" />
            <div>
              <div class="src">{{ SOURCE_META[id]?.label || id }}</div>
              <div class="detail">{{ r.ok ? `${r.count} listings found` : r.error }}</div>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 40;
}
.panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(440px, 100vw);
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
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
}
h2 { margin: 0; font-size: 18px; }
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
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-dim);
}
.help { margin: 0 0 12px; color: var(--text-muted); font-size: 13px; line-height: 1.5; }
.help.small { margin: 10px 0 0; font-size: 12px; color: var(--text-dim); }
.muted { color: var(--text-muted); }
code {
  font-family: var(--font-mono);
  font-size: 0.92em;
  background: var(--panel-raised);
  padding: 1px 5px;
  border-radius: 4px;
}

.segmented {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.segmented button {
  padding: 9px 6px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
}
.segmented button:hover { border-color: var(--border-strong); color: var(--text); }
.segmented button.active {
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
  background: color-mix(in srgb, var(--accent) 10%, var(--panel));
}

.status-card {
  padding: 16px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--panel);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}
.label { color: var(--text-muted); }
.btn {
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
}
.btn:disabled { opacity: 0.7; cursor: progress; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.results {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.results li { display: flex; gap: 10px; align-items: flex-start; }
.results svg { flex-shrink: 0; margin-top: 2px; }
.ok { color: var(--plus); }
.bad { color: var(--minus); }
.src { font-size: 13px; font-weight: 500; }
.detail { font-size: 12px; color: var(--text-muted); line-height: 1.45; }
</style>
