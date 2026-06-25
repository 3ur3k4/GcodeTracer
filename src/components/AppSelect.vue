<script setup lang="ts" generic="T extends string | number">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ChevronDown } from '@lucide/vue'

const props = defineProps<{
  modelValue: T
  options: { value: T; label: string; badge?: string }[]
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: T] }>()

const open = ref(false)
const rootRef = ref<HTMLDivElement | null>(null)
const dropdownRef = ref<HTMLDivElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})

const selectedLabel = computed(() =>
  props.options.find((o) => o.value === props.modelValue)?.label ?? String(props.modelValue),
)

function openDropdown(): void {
  if (props.disabled) return
  const rect = rootRef.value?.getBoundingClientRect()
  if (rect) {
    const availableWidth = window.innerWidth - rect.left - 8
    dropdownStyle.value = {
      top: `${rect.bottom + 2}px`,
      left: `${rect.left}px`,
      minWidth: `${rect.width}px`,
      maxWidth: `${Math.max(rect.width, availableWidth)}px`,
    }
  }
  open.value = !open.value
}

function select(value: T): void {
  emit('update:modelValue', value)
  open.value = false
}

function onDocClick(event: MouseEvent): void {
  const target = event.target as Node
  if (!rootRef.value?.contains(target) && !dropdownRef.value?.contains(target)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))
</script>

<template>
  <div ref="rootRef" class="selectRoot" :class="{ disabled, open }">
    <button class="trigger" :disabled="disabled" @click="openDropdown">
      <span class="triggerText">{{ selectedLabel }}</span>
      <ChevronDown class="chevron" :size="13" :stroke-width="1.75" />
    </button>
    <Teleport to="body">
      <div v-if="open" ref="dropdownRef" class="dropdown" :style="dropdownStyle">
        <button
          v-for="opt in options"
          :key="String(opt.value)"
          class="option"
          :class="{ selected: opt.value === modelValue }"
          @click="select(opt.value)"
        >
          <span v-if="opt.badge" class="badge">{{ opt.badge }}</span>
          <span class="optionText">{{ opt.label }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>


<style scoped>
.selectRoot {
  position: relative;
}
.trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 7px 8px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--tp);
  background-color: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  text-align: left;
}
.selectRoot.open .trigger {
  border-color: var(--ts);
}
.trigger:disabled {
  opacity: 0.5;
}
.triggerText {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chevron {
  flex: none;
  color: var(--ts);
  transition: transform 0.15s ease;
}
.selectRoot.open .chevron {
  transform: rotate(180deg);
}
.dropdown {
  position: fixed;
  z-index: 9999;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  overflow: hidden;
  min-width: 120px;
}
.option {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  padding: 7px 10px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--tp);
  background: transparent;
  border: none;
  text-align: left;
  overflow: hidden;
}
.optionText {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.option:hover {
  background-color: var(--surface2);
}
.option.selected {
  color: var(--accent);
}
.badge {
  font-size: 10px;
  color: var(--warning);
  font-weight: 600;
}
</style>
