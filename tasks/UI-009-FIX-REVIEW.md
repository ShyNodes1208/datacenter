# UI-009: Fix Codex review issues for UI-002~008

## Issues to fix

### 1. MEDIUM: 补充缺失的 CSS 变量
在 tokens.css 中增加以下变量，替换硬编码值：

```css
--color-nav-bg: #2c3e50;
--color-text-inverse: #ffffff;
--color-table-header: #eef1f5;
--color-table-stripe: #f8fafc;
--color-table-hover: #eef6ff;
--color-error-bg: #fdecea;
--color-btn-secondary: #eef1f5;
```

将各页面中的硬编码值替换为变量：
- App.vue: #2c3e50 → var(--color-nav-bg)
- ServerListView: #eef1f5, #f8fafc, #eef6ff → variables
- ServerDetailView: #fdecea → var(--color-error-bg)
- ServerFormView: #eef1f5 → var(--color-btn-secondary)

### 2. MEDIUM: UI-007 按钮加 Unicode 图标
HomeView 操作按钮前加字符图标：
- 新增 → ✚
- 编辑 → ✎
- 删除 → ✕
- 导入 → ↥

不要引入图标库。

### 3. MINOR: 导航栏加 flex-wrap 和文字截断
App.vue 导航栏增加 `flex-wrap: wrap` 和用户名 `max-width + text-overflow: ellipsis`。

### 4. MINOR: 清理末尾空行
HomeView.vue 和 RackDeviceView.vue 删除文件末尾多余空行。

## Constraints
- 不过度设计
- 不影响任何功能
