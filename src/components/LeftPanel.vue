<script setup lang="ts">
import MachineStateBar from '@/components/MachineStateBar.vue'
import CoordinateSection from '@/components/CoordinateSection.vue'
import JogSection from '@/components/JogSection.vue'
</script>

<template>
  <aside class="panel">
    <MachineStateBar />
    <CoordinateSection />
    <JogSection />
  </aside>
</template>

<style scoped>
.panel {
  width: 196px;
  flex: none;
  display: flex;
  flex-direction: column;
  background-color: var(--surface);
  border-right: 1px solid var(--border);
  overflow-y: auto;
}
</style>
