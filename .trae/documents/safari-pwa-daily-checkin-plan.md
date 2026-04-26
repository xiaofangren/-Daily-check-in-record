# Safari 友好 PWA 日常打卡工具 — 实施计划

## 项目概述
构建一个 Safari/iOS 友好的 PWA 日常打卡工具，纯前端实现（HTML + CSS + JS），支持离线使用、Siri 语音打卡、历史记录查看与导出。

## 技术关键点

### Safari PWA 注意事项
- IndexedDB 在 Safari 上存在不稳定性，需添加错误重试和数据校验
- Safari 存储配额约 50MB，需监控使用量
- Service Worker 缓存容量有限，仅缓存必要资源
- iOS 不支持推送通知点击事件，无需考虑
- `apple-mobile-web-app-capable` 等 meta 标签必须配置
- 需提供 120x120 / 152x152 / 167x167 / 180x180 多尺寸图标

### Siri 集成方案（纯前端）
由于无后端，采用 **URL Scheme 参数方案**：
- iOS 快捷指令通过「打开 URL」动作打开 PWA 页面，附带查询参数
- PWA 加载时检测 URL 参数，自动执行打卡操作
- 示例：`https://your-domain.com/?action=checkin&item=洗头`
- 打卡完成后显示确认提示，用户可关闭页面

---

## 文件结构

```
日常记录器/
├── index.html          # 主页面（含所有视图容器）
├── css/
│   └── style.css       # 全部样式（移动端优先）
├── js/
│   ├── app.js          # 应用入口、路由、UI 交互
│   ├── db.js           # IndexedDB 封装层
│   ├── calendar.js     # 日历视图组件
│   └── export.js       # CSV 导出功能
├── sw.js               # Service Worker（离线缓存）
├── manifest.json       # PWA 清单文件
├── icons/
│   ├── icon-120.png    # 120x120
│   ├── icon-152.png    # 152x152
│   ├── icon-167.png    # 167x167
│   └── icon-180.png    # 180x180
└── siri-guide.html     # iOS 快捷指令配置教程页面
```

---

## 实施步骤

### 步骤 1：创建 PWA 基础文件
**文件：`manifest.json`**
- `name`: "日常打卡"
- `short_name`: "打卡"
- `start_url`: "./index.html"
- `display`: "standalone"
- `background_color`: "#ffffff"
- `theme_color`: "#4A90D9"
- `icons`: 多尺寸 PNG 图标引用

**文件：`index.html`**
- 配置所有必需 meta 标签：
  - `apple-mobile-web-app-capable`
  - `apple-mobile-web-app-status-bar-style`
  - `apple-mobile-web-app-title`
  - `viewport`（禁止缩放）
  - `apple-touch-icon` 各尺寸
- 注册 Service Worker
- 页面结构包含三个视图容器：
  - 打卡主页（`#checkin-view`）
  - 历史记录（`#history-view`）
  - 设置/管理（`#settings-view`）
- 底部导航栏（Tab Bar）

### 步骤 2：CSS 样式（移动端优先）
**文件：`css/style.css`**
- CSS 变量定义主题色
- 移动端优先媒体查询
- Safe area 适配（`env(safe-area-inset-*)`）
- 打卡项卡片样式（网格布局）
- 日历视图样式
- 底部 Tab Bar 样式
- 模态框样式（添加/编辑打卡项）
- 动画效果（打卡完成动画）
- 暗色模式支持（`prefers-color-scheme`）

### 步骤 3：IndexedDB 数据层
**文件：`js/db.js`**
- 数据库名：`DailyCheckinDB`，版本 1
- 两个 Object Store：
  - `items`：打卡项目定义
    - `id`（autoIncrement 主键）
    - `name`（项目名称）
    - `icon`（emoji 图标）
    - `color`（标识色）
    - `createdAt`（创建时间）
  - `records`：打卡记录
    - `id`（autoIncrement 主键）
    - `itemId`（关联项目 ID，索引）
    - `timestamp`（打卡时间戳，索引）
    - `date`（日期字符串 YYYY-MM-DD，索引）
- 封装方法：
  - `initDB()` — 初始化数据库，含错误重试
  - `addItem(item)` / `updateItem(item)` / `deleteItem(id)`
  - `checkin(itemId)` — 记录打卡
  - `getRecordsByDate(date)` / `getRecordsByItem(itemId)` / `getRecordsByDateRange(start, end)`
  - `getAllItems()` / `getItemById(id)`
  - `exportAllRecords()` — 导出全部记录
  - `importRecords(data)` — 导入记录
- Safari 兼容处理：
  - 事务错误重试机制
  - 数据完整性校验
  - 存储配额监控

### 步骤 4：核心打卡功能
**文件：`js/app.js`**
- 初始化流程：
  1. 检测 URL 参数（Siri 快捷指令触发）
  2. 初始化 DB
  3. 渲染打卡项列表
  4. 注册 Service Worker
- 打卡主页功能：
  - 渲染所有打卡项为卡片网格
  - 点击卡片 → 调用 `checkin(itemId)` → 播放动画 → 显示完成状态
  - 今日已打卡项显示 ✓ 标记和打卡时间
  - 长按卡片 → 编辑/删除选项
- 添加打卡项：
  - 模态框表单：名称、emoji 图标选择、颜色选择
  - 预设常用项目模板（洗头、运动、喝水、吃药、早睡等）
- URL 参数处理（Siri 集成）：
  - 检测 `?action=checkin&item=项目名`
  - 自动查找匹配项目并打卡
  - 若项目不存在，提示创建
  - 打卡成功后显示确认信息

### 步骤 5：日历视图与历史记录
**文件：`js/calendar.js`**
- 月历网格组件：
  - 显示当月日历
  - 有打卡记录的日期显示小圆点
  - 点击日期 → 显示当日打卡详情
  - 左右滑动切换月份
- 历史记录列表：
  - 按日期分组显示
  - 支持按项目筛选
  - 显示每个打卡项的完成时间
- 整合到 `#history-view` 视图

### 步骤 6：CSV 导出与数据管理
**文件：`js/export.js`**
- 导出功能：
  - 生成 CSV 文件（UTF-8 BOM 编码，Excel 兼容）
  - 列：日期、时间、项目名称、项目图标
  - 支持按日期范围筛选导出
  - 使用 `<a download>` 触发下载
- 数据管理：
  - 清除全部数据（二次确认）
  - 存储使用量显示

### 步骤 7：Service Worker 离线缓存
**文件：`sw.js`**
- 缓存策略：Cache First
- 预缓存文件列表：
  - `index.html`
  - `css/style.css`
  - `js/app.js`、`js/db.js`、`js/calendar.js`、`js/export.js`
  - `manifest.json`
  - 图标文件
- `install` 事件：预缓存所有资源
- `fetch` 事件：Cache First 策略
- `activate` 事件：清理旧版本缓存

### 步骤 8：iOS 快捷指令教程页面
**文件：`siri-guide.html`**
- 详细的图文教程（使用纯 HTML/CSS，不依赖 JS 模块）
- 内容包含：
  1. 前提条件（部署 PWA 到 HTTPS 域名）
  2. 创建快捷指令步骤
     - 打开「快捷指令」App → 新建快捷指令
     - 添加「文本」动作，输入项目名（如"洗头"）
     - 添加「URL」动作，拼接 URL：`https://域名/?action=checkin&item=快捷指令输入`
     - 添加「打开 URL」动作
     - 设置 Siri 短语：「记录洗头」
  3. 多项目快捷指令模板
  4. 常见问题解答
- 从设置页面链接到此教程

### 步骤 9：图标资源
- 生成 4 个尺寸的 PNG 图标（120/152/167/180）
- 使用 SVG 内联生成简单的打卡图标（✓ 勾号 + 圆形背景）
- 通过 Canvas API 在构建时生成 PNG

---

## 数据流示意

```
用户点击打卡 → app.js → db.js (IndexedDB) → 更新 UI
Siri 触发 → URL 参数 → app.js 检测 → db.js → 显示确认
历史查看 → calendar.js → db.js → 渲染日历/列表
导出 CSV → export.js → db.js → 生成文件下载
```

---

## 实施顺序

1. ✅ 创建 `manifest.json` + `index.html`（含 meta 标签和页面结构）
2. ✅ 创建 `css/style.css`（完整样式）
3. ✅ 创建 `js/db.js`（IndexedDB 封装）
4. ✅ 创建 `js/app.js`（核心打卡逻辑 + URL 参数处理）
5. ✅ 创建 `js/calendar.js`（日历视图）
6. ✅ 创建 `js/export.js`（CSV 导出）
7. ✅ 创建 `sw.js`（Service Worker）
8. ✅ 创建 `siri-guide.html`（快捷指令教程）
9. ✅ 生成图标资源
10. ✅ 整体测试与调试
