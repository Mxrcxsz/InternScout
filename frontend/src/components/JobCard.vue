<script setup>
import { computed } from 'vue';
import ScoreRing from './ScoreRing.vue';
import Icon from './Icon.vue';
import { SOURCE_META, timeAgo, postedAt } from '../utils';

const props = defineProps({
  job: { type: Object, required: true },
  status: { type: String, default: null }, // 'saved' | 'applied' | null
});
const emit = defineEmits(['open', 'toggle-save', 'toggle-applied']);

const source = computed(() => SOURCE_META[props.job.source] || { label: props.job.source, color: 'var(--text-dim)' });
const topReason = computed(() => props.job.match.reasons.find((r) => r.kind === 'plus') || props.job.match.reasons[0]);
</script>

<template>
  <article class="card" :class="job.match.band" @click="emit('open', job)">
    <div class="head">
      <div class="who">
        <span class="company">{{ job.company || 'Unknown company' }}</span>
        <h3 class="title">{{ job.title }}</h3>
        <p class="meta">
          <span v-if="job.location">{{ job.location }}</span>
          <span v-if="job.pay">{{ job.pay }}</span>
          <span>{{ timeAgo(postedAt(job)) }}</span>
          <span class="source" :style="{ color: source.color }">{{ source.label }}</span>
        </p>
      </div>
      <ScoreRing :score="job.match.score" :band="job.match.band" />
    </div>

    <div class="chips">
      <span class="chip category">{{ job.match.category.label }}</span>
      <span v-for="s in job.match.matchedSkills.slice(0, 3)" :key="s" class="chip skill">{{ s }}</span>
      <span v-if="job.match.matchedSkills.length > 3" class="chip more">+{{ job.match.matchedSkills.length - 3 }}</span>
    </div>

    <p v-if="topReason" class="reason" :class="topReason.kind">
      <Icon :name="topReason.kind === 'plus' ? 'plus' : topReason.kind === 'minus' ? 'minus' : 'info'" :size="13" />
      <span>{{ topReason.text }}</span>
    </p>

    <div class="actions" @click.stop>
      <button class="act" :class="{ on: status === 'saved' }" @click="emit('toggle-save', job)">
        <Icon name="bookmark" :size="14" /> {{ status === 'saved' ? 'Saved' : 'Save' }}
      </button>
      <button class="act" :class="{ on: status === 'applied' }" @click="emit('toggle-applied', job)">
        <Icon name="check" :size="14" /> {{ status === 'applied' ? 'Applied' : 'Mark applied' }}
      </button>
      <a class="act link" :href="job.url" target="_blank" rel="noopener noreferrer">
        Open <Icon name="external" :size="13" />
      </a>
    </div>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px 16px 0;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  min-width: 0;
}
.card:hover {
  border-color: var(--border-strong);
  background: var(--panel-hover);
}

.head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.who { flex: 1; min-width: 0; }
.company {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}
.title {
  margin: 3px 0 4px;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.meta {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  flex-wrap: wrap;
  gap: 2px 0;
}
.meta span:not(:last-child)::after {
  content: '·';
  margin: 0 6px;
  color: var(--text-dim);
}
.source { font-weight: 500; }

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 5px;
  border: 1px solid var(--border);
  color: var(--text-muted);
  white-space: nowrap;
}
.chip.category {
  color: var(--text);
  background: var(--panel-raised);
}
.chip.skill {
  color: var(--plus);
  border-color: color-mix(in srgb, var(--plus) 35%, transparent);
}

.reason {
  margin: 0;
  display: flex;
  gap: 6px;
  align-items: flex-start;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-muted);
}
.reason svg { flex-shrink: 0; margin-top: 2px; }
.reason.plus svg { color: var(--plus); }
.reason.minus svg { color: var(--minus); }
.reason span {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.actions {
  margin-top: auto;
  display: flex;
  border-top: 1px solid var(--border);
  cursor: default;
}
.act {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 11px 4px;
  font-size: 12px;
  color: var(--text-muted);
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
}
.act + .act { border-left: 1px solid var(--border); }
.act:hover { color: var(--text); }
.act.on { color: var(--accent); font-weight: 600; }
</style>
