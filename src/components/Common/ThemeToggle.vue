<template>
  <n-button circle class="theme-toggle" size="medium" @click="toggleTheme">
    <template #icon>
      <n-icon v-if="isDark">
        <Sunny></Sunny>
      </n-icon>
      <n-icon v-else>
        <Moon></Moon>
      </n-icon>
    </template>
  </n-button>
</template>

<script setup>
import { Moon, Sunny } from "@vicons/ionicons5";
import { useTheme } from "@/composables/useTheme";

const { isDark, toggleTheme } = useTheme();
</script>

<style scoped lang="scss">
.theme-toggle {
  border: 1px solid var(--border-light);
  transition: all var(--transition-bounce);
  width: 40px;
  height: 40px;

  &:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-light);
  }
}

@media (max-width: 768px) {
  .theme-toggle {
    width: 44px;
    height: 44px;
  }
}
</style>
