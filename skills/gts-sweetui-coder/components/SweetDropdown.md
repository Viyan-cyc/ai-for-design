# 下拉菜单 SweetDropdown / SweetDropdownMenu / SweetDropdownItem

```vue
<SweetDropdown trigger="click" placement="bottom-start" @command="handleCommand">
  <button>更多操作 <SweetIcon icon-class="sweetui-icon-arrow-down" :size="12" /></button>
  <template #dropdown>
    <SweetDropdownMenu>
      <SweetDropdownItem command="edit">编辑</SweetDropdownItem>
      <SweetDropdownItem command="delete" divided>删除</SweetDropdownItem>
    </SweetDropdownMenu>
  </template>
</SweetDropdown>
```

关键 props（Dropdown）：`trigger`（hover/click/contextmenu）、`placement`、`disabled`、`popper-class`。
关键 events：`command`、`visible-change`。
关键 props（DropdownItem）：`command`、`disabled`、`divided`、`icon`。
