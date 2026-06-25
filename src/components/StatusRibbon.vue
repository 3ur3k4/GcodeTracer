<script setup lang="ts">
import { useAppStore } from '@/stores/appStore'

const store = useAppStore()
</script>

<template>
  <footer class="ribbon">
    <span class="indicator">
      <span class="dot" :class="{ active: store.connection.connected }" />
      <span class="text">{{ store.connection.connected ? store.connection.port : 'Not connected' }}</span>
    </span>
    <span class="indicator">
      <span class="dot" :class="{ active: store.osc.enabled }" />
      <span class="text">{{ store.osc.enabled ? `OSC ${store.osc.ip}:${store.osc.port}` : 'OSC off' }}</span>
    </span>
  </footer>
</template>

<style scoped>
.ribbon {
  height: 30px;
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 10px;
  background-color: var(--surface);
  border-top: 1px solid var(--border);
}
.indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--ts);
}
.dot.active {
  background-color: var(--accent);
}
.text {
  font-size: 12px;
  color: var(--ts);
}
</style>
