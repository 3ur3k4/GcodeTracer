<script setup lang="ts">
import { useAppStore } from '@/stores/appStore'
import { useGcodeFileStore } from '@/stores/gcodeFileStore'
import { useIpc } from '@/composables/useIpc'

const store = useAppStore()
const gcodeFile = useGcodeFileStore()
const ipc = useIpc()

function revealInFinder(): void {
  if (gcodeFile.filePath) ipc.revealFile(gcodeFile.filePath)
}
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
    <span class="spacer" />
    <span class="fileInfo">
      <template v-if="gcodeFile.fileName">
        <span class="text fileName" :class="{ clickable: gcodeFile.filePath }" :title="gcodeFile.filePath || undefined" @click="revealInFinder">{{ gcodeFile.fileName }}</span>
        <span class="text muted">{{ gcodeFile.lines.length.toLocaleString() }} lines</span>
      </template>
      <span v-else class="text muted">No file loaded</span>
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
.spacer {
  flex: 1;
}
.fileInfo {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fileName {
  color: var(--tp);
  font-family: var(--font-mono);
  max-width: 260px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fileName.clickable {
  cursor: pointer;
}
.fileName.clickable:hover {
  color: var(--accent);
}
.muted {
  opacity: 0.5;
  font-family: var(--font-mono);
}
</style>
