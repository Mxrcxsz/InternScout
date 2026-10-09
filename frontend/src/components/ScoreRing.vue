<script setup>
import { computed } from 'vue';

const props = defineProps({
  score: { type: Number, required: true },
  band: { type: String, default: 'low' },
  size: { type: Number, default: 40 },
});

const R = 16;
const CIRC = 2 * Math.PI * R;
const dash = computed(() => `${(props.score / 100) * CIRC} ${CIRC}`);
</script>

<template>
  <div
    class="ring"
    :class="band"
    :style="{ width: size + 'px', height: size + 'px' }"
    role="img"
    :aria-label="`${score}% match`"
  >
    <svg viewBox="0 0 40 40">
      <circle class="track" cx="20" cy="20" :r="R" />
      <circle class="value" cx="20" cy="20" :r="R" :stroke-dasharray="dash" />
    </svg>
    <span :style="{ fontSize: size * 0.3 + 'px' }">{{ score }}</span>
  </div>
</template>

<style scoped>
.ring {
  position: relative;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  --c: var(--match-low);
}
.ring.strong { --c: var(--match-strong); }
.ring.good { --c: var(--match-good); }
.ring.fair { --c: var(--match-fair); }

svg {
  position: absolute;
  inset: 0;
  transform: rotate(-90deg);
}
circle {
  fill: none;
  stroke-width: 3.5;
}
.track { stroke: var(--border); }
.value {
  stroke: var(--c);
  stroke-linecap: round;
  transition: stroke-dasharray 0.4s ease;
}
span {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--text);
}
</style>
