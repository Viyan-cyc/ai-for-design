<script setup>
import { ref } from 'vue'
import {
  SweetContainer,
  SweetHeader,
  SweetAside,
  SweetMain,
  SweetMenu,
  SweetSubmenu,
  SweetMenuItem,
  SweetBreadcrumb,
  SweetBreadcrumbItem,
} from '@hw-seq/sweet-ui-base'
import IconPlus from '../../../components/icon-plus.vue'

defineOptions({ name: 'AppLayout' })

const collapsed = ref(false)
const activeMenu = ref('1')
</script>

<template>
  <sweet-container class="layout-container">
    <sweet-header class="layout-header">
      <div class="header-content">
        <div class="logo">系统名称</div>
        <sweet-menu mode="horizontal" :default-active="activeMenu">
          <sweet-menu-item index="1">首页</sweet-menu-item>
          <sweet-menu-item index="2">管理</sweet-menu-item>
        </sweet-menu>
      </div>
    </sweet-header>

    <sweet-container>
      <sweet-aside width="200px" class="layout-aside">
        <sweet-menu :default-active="activeMenu" :collapse="collapsed">
          <sweet-menu-item index="1">
            <icon-plus name="home" />
            <span>首页</span>
          </sweet-menu-item>
          <sweet-submenu index="2">
            <template #title>
              <icon-plus name="folder" />
              <span>系统管理</span>
            </template>
            <sweet-menu-item index="2-1">用户管理</sweet-menu-item>
            <sweet-menu-item index="2-2">角色管理</sweet-menu-item>
          </sweet-submenu>
        </sweet-menu>
      </sweet-aside>

      <sweet-main class="layout-main">
        <sweet-breadcrumb separator="/" class="breadcrumb">
          <sweet-breadcrumb-item>首页</sweet-breadcrumb-item>
          <sweet-breadcrumb-item>系统管理</sweet-breadcrumb-item>
          <sweet-breadcrumb-item>用户管理</sweet-breadcrumb-item>
        </sweet-breadcrumb>
        <div class="page-content">
          <slot />
        </div>
      </sweet-main>
    </sweet-container>
  </sweet-container>
</template>

<style scoped lang="less">
.layout-container {
  height: 100vh;
}

.layout-header {
  background: var(--color-bg-5);
  border-bottom: 1px solid var(--color-border-separator);
}

.header-content {
  display: flex;
  align-items: center;
  height: 100%;
}

.logo {
  width: 200px;
  font-size: var(--font-size-big);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  text-align: center;
}

.layout-aside {
  background: var(--color-bg-5);
  border-right: 1px solid var(--color-border-separator);
}

.layout-main {
  background: var(--color-bg-1);
  padding: var(--space-size-16);
}

.breadcrumb {
  margin-bottom: var(--space-size-16);
}

.page-content {
  background: var(--color-bg-5);
  border-radius: var(--radius-size-medium);
  padding: var(--space-size-16);
  min-height: calc(100vh - 180px);
}
</style>
