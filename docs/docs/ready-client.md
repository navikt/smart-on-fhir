---
outline: deep
---

<script setup>
import { data } from './code-docs/code.data.ts'
</script>

# SmartClient

<div v-if="data?.SmartClient">
  <div :class="$style.block">
    {{ data.SmartClient.description }}
  </div>

  <h2>Methods</h2>

  <ul>
    <li v-for="m in data.SmartClient.methods" :key="m.name">
      <h3><code>{{ m.name }}()</code></h3>
      <div :class="$style.block" v-if="m.description">{{ m.description }}</div>
      <em v-else>No description.</em>
    </li>
  </ul>
</div>

<style module>
.block { white-space: pre-wrap; }
</style>
