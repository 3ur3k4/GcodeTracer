<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/appStore'
import ConnectionPanel from '@/components/ConnectionPanel.vue'
import StatusPanel from '@/components/StatusPanel.vue'
import JobPanel from '@/components/JobPanel.vue'
import ConsolePanel from '@/components/ConsolePanel.vue'
import VisualizerPanel from '@/components/VisualizerPanel.vue'
import JogPanel from '@/components/JogPanel.vue'
import OscSettingsPanel from '@/components/OscSettingsPanel.vue'

const store = useAppStore()
let disposeInit: (() => void) | null = null

onMounted(() => {
  disposeInit = store.init()
})
onUnmounted(() => {
  disposeInit?.()
})
</script>

<template>
  <div class="app">
    <header class="header">
      <h1 class="logo">Gcode Tracer</h1>
    </header>
    <main class="main">
      <ConnectionPanel />
      <StatusPanel />
      <JobPanel />
      <ConsolePanel />
      <VisualizerPanel />
      <JogPanel />
      <OscSettingsPanel />
    </main>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.header {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}
.logo {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}
.main {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
  padding: var(--space-4);
  align-content: start;
  overflow-y: auto;
}
</style>
