<script setup>
import { ref } from 'vue'
import { ElPagination } from 'element-plus'

defineOptions({ name: 'PaginationDemo' })

const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(286)

const handlePageChange = (page) => {
  currentPage.value = page
  // 拉取对应页数据
}

const handleSizeChange = (size) => {
  pageSize.value = size
  currentPage.value = 1
  // 拉取对应页数据
}
</script>

<template>
  <div class="demo-block">
    <ElPagination
      :current-page="currentPage"
      :page-size="pageSize"
      :total="total"
      layout="total, sizes, prev, pager, next, jumper"
      :page-sizes="[10, 20, 50, 100]"
      @current-change="handlePageChange"
      @size-change="handleSizeChange"
    />
  </div>
</template>

<style scoped lang="less">
.demo-block {
  display: flex;
  justify-content: flex-end;
}
</style>
