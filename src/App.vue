<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useAppStore } from '@/stores/appStore'
import TopToolbar from '@/components/TopToolbar.vue'
import LeftPanel from '@/components/LeftPanel.vue'
import VisualizerPanel from '@/components/VisualizerPanel.vue'
import ConsoleDrawer from '@/components/ConsoleDrawer.vue'
import StatusRibbon from '@/components/StatusRibbon.vue'
import SettingsDrawer from '@/components/SettingsDrawer.vue'

const store = useAppStore()
let disposeInit: (() => void) | null = null

const settingsOpen = ref(false)

onMounted(() => {
  disposeInit = store.init()
})
onUnmounted(() => {
  disposeInit?.()
})
</script>

<template>
  <div class="app">
    <TopToolbar @toggle-settings="settingsOpen = !settingsOpen" />
    <div class="body">
      <LeftPanel />
      <div class="content">
        <VisualizerPanel />
        <ConsoleDrawer />
      </div>
      <div v-if="settingsOpen" class="settingsAnchor">
        <SettingsDrawer @close="settingsOpen = false" />
      </div>
    </div>
    <StatusRibbon />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.body {
  position: relative;
  flex: 1;
  display: flex;
  min-height: 0;
}
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.settingsAnchor {
  position: absolute;
  right: 0;
  top: 0;
}
</style>
