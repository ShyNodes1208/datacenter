# UI-001: 建立设计令牌（CSS 变量）

## 现状

所有页面使用硬编码的 inline style，颜色、字号、间距散落各处，没有一致的设计语言。

## 要求

新建 `src/frontend/src/styles/tokens.css`，定义 CSS 变量，在 `main.ts` 中 import。

```css
:root {
  --color-primary: #4a90d9;
  --color-primary-light: #b3d9ff;
  --color-success: #52c41a;
  --color-danger: #e74c3c;
  --color-warning: #f0ad4e;
  --color-bg: #f5f7fa;
  --color-bg-card: #ffffff;
  --color-border: #e0e0e0;
  --color-text: #333333;
  --color-text-secondary: #888888;
  --radius: 6px;
  --shadow: 0 1px 3px rgba(0,0,0,0.1);
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --font-sm: 12px;
  --font-md: 14px;
  --font-lg: 16px;
}
```

然后逐步将各页面的硬编码值替换为 CSS 变量。

## 约束

- 不过度设计：不加 CSS 框架，不引入新依赖
- 不改变任何功能逻辑
