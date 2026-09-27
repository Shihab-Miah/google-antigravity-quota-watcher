# Status Bar System

## 1. Identity

- **What it is:** 状态栏显示系统，负责在 VS Code 底部状态栏展示配额信息。
- **Purpose:** 提供直观的配额可视化和用户交互入口。

## 2. Core Components

- `src/statusBar.ts` (StatusBarService): 状态栏服务主类
- `src/types.ts` (QuotaSnapshot, ModelQuotaInfo): 配额数据类型
- `src/i18n/localizationService.ts` (LocalizationService): 国际化服务

## 3. Execution Flow (LLM Retrieval Map)

### 3.1 StatusBarService 初始化

**入口**: `src/statusBar.ts:29-51`

**参数**:
- `warningThreshold`: 警告阈值（默认 50%）
- `criticalThreshold`: 临界阈值（默认 30%）
- `showPromptCredits`: 是否显示 Prompt Credits
- `showPlanName`: 是否显示订阅计划名称
- `showGeminiPro`: 是否显示 Gemini Pro
- `showGeminiFlash`: 是否显示 Gemini Flash
- `displayStyle`: 显示风格（percentage/progressBar/dots）

**初始化步骤**:

1. **创建状态栏项** (`src/statusBar.ts:39-42`)
   - 调用 `vscode.window.createStatusBarItem()`
   - 位置: 右侧（`StatusBarAlignment.Right`）
   - 优先级: 100

2. **设置命令** (`src/statusBar.ts:43`)
   - 默认命令: `antigravity-quota-watcher.showQuota`
   - 点击状态栏时触发

3. **保存配置** (`src/statusBar.ts:44-50`)
   - 保存所有阈值和显示选项

### 3.2 更新显示 (updateDisplay)

**入口**: `src/statusBar.ts:53-131`

**执行步骤**:

1. **处理快速刷新动画** (`src/statusBar.ts:55-64`)
   - 如果正在快速刷新且未达到最小动画时长（1 秒）
   - 延迟调用 `updateDisplay`，确保动画完整显示

2. **缓存快照** (`src/statusBar.ts:67`)
   - 保存 `lastSnapshot` 用于后续恢复

3. **清除刷新状态** (`src/statusBar.ts:70-73`)
   - 重置 `isQuickRefreshing` 标志
   - 设置命令为 `quickRefreshQuota`（允许点击刷新）

4. **构建显示文本** (`src/statusBar.ts:75-114`)
   - 调用 `selectModelsToDisplay()` 选择要显示的模型
   - 遍历模型，根据 `displayStyle` 生成文本：
     - **percentage**: `🟢 Claude: 85%`
     - **progressBar**: `🟢 Claude ███████░`
     - **dots**: `🟢 Claude ●●●●○`
   - 使用 `getStatusIndicator()` 获取状态符号（🟢🟡🔴⚫）

5. **更新状态栏** (`src/statusBar.ts:116-130`)
   - 设置 `statusBarItem.text`
   - 清除背景色和文字颜色
   - 调用 `updateTooltip()` 更新 Tooltip
   - 显示状态栏

### 3.3 模型选择 (selectModelsToDisplay)

**入口**: `src/statusBar.ts:231-257`

**选择规则**:

1. **Claude（必须显示）** (`src/statusBar.ts:235-238`)
   - 查找非 Thinking 版本的 Claude
   - 调用 `isClaudeWithoutThinking()` 判断

2. **Gemini Pro（可配置）** (`src/statusBar.ts:241-246`)
   - 如果 `showGeminiPro` 为 true
   - 查找包含 "Pro" 和 "Low" 的模型
   - 调用 `isProLow()` 判断

3. **Gemini Flash（可配置）** (`src/statusBar.ts:249-254`)
   - 如果 `showGeminiFlash` 为 true
   - 查找包含 "Gemini" 和 "Flash" 的模型
   - 调用 `isGemini3Flash()` 判断

**返回**: 最多 3 个模型的数组

### 3.4 状态指示符 (getStatusIndicator)

**入口**: `src/statusBar.ts:140-149`

**规则**:

| 剩余百分比 | 符号 | 含义 |
|-----------|------|------|
| ≤ 0% | ⚫ | 配额耗尽 |
| ≤ criticalThreshold (默认 30%) | 🔴 | 配额不足 |
| ≤ warningThreshold (默认 50%) | 🟡 | 配额中等 |
| > warningThreshold | 🟢 | 配额充足 |

### 3.5 显示风格

#### 3.5.1 百分比模式 (percentage)

**格式**: `🟢 Claude: 85%`

**实现**: `src/statusBar.ts:98, 107`
- 直接显示 `remainingPercentage.toFixed(0)%`

#### 3.5.2 进度条模式 (progressBar)

**格式**: `🟢 Claude ███████░`

**实现**: `src/statusBar.ts:316-329`

1. **计算方块数** (`src/statusBar.ts:322`)
   - 总方块数: 8
   - 填充方块数: `Math.round((percentage / 100) * 8)`

2. **生成进度条** (`src/statusBar.ts:328`)
   - 填充字符: `█`
   - 空白字符: `░`
   - 拼接: `███████░`

#### 3.5.3 圆点模式 (dots)

**格式**: `🟢 Claude ●●●●○`

**实现**: `src/statusBar.ts:331-344`

1. **计算圆点数** (`src/statusBar.ts:337`)
   - 总圆点数: 5
   - 填充圆点数: `Math.round((percentage / 100) * 5)`

2. **生成圆点** (`src/statusBar.ts:343`)
   - 填充字符: `●`
   - 空白字符: `○`
   - 拼接: `●●●●○`

### 3.6 Tooltip 更新 (updateTooltip)

**入口**: `src/statusBar.ts:184-229`

**内容**:

1. **标题** (`src/statusBar.ts:192`)
   - "Antigravity 配额监控"
   - 如果有 planName，显示 "(Pro)"

2. **用户邮箱** (`src/statusBar.ts:195-197`)
   - 仅 GOOGLE_API 方法显示
   - 格式: `📧 user@example.com`

3. **Prompt Credits** (`src/statusBar.ts:199-204`)
   - 如果 `showPromptCredits` 为 true
   - 显示可用/总量和剩余百分比

4. **模型配额表格** (`src/statusBar.ts:206-225`)
   - 按字母顺序排序
   - 表格列: 模型 | 状态 | 重置时间
   - 每行格式: `| 🔥 Claude | 85.0% | 2h 30m from now |`

### 3.7 特殊状态显示

#### 3.7.1 快速刷新 (showQuickRefreshing)

**入口**: `src/statusBar.ts:354-370`

**显示**: `$(sync~spin) 刷新中...`

**实现**:
- 设置 `isQuickRefreshing` 标志
- 记录刷新开始时间
- 在当前文本前添加旋转图标
- 最小显示时长: 1 秒

#### 3.7.2 检测中 (showDetecting)

**入口**: `src/statusBar.ts:372-377`

**显示**: `$(search~spin) 检测中...`

#### 3.7.3 初始化中 (showInitializing)

**入口**: `src/statusBar.ts:379-384`

**显示**: `$(loading~spin) 初始化中...`

#### 3.7.4 获取中 (showFetching)

**入口**: `src/statusBar.ts:386-391`

**显示**: `$(sync~spin) 获取配额中...`

#### 3.7.5 重试中 (showRetrying)

**入口**: `src/statusBar.ts:393-398`

**显示**: `$(sync~spin) 重试中 (1/3)...`

**特点**: 黄色背景（警告）

#### 3.7.6 错误 (showError)

**入口**: `src/statusBar.ts:400-407`

**显示**: `$(error) 错误`

**特点**:
- 红色背景
- Tooltip 显示错误详情
- 命令改为 `refreshQuota`（点击重试）

#### 3.7.7 未登录 (showNotLoggedIn)

**入口**: `src/statusBar.ts:419-425`

**显示**: `$(account) 未登录`

**特点**:
- 命令改为 `googleLogin`（点击登录）

#### 3.7.8 登录中 (showLoggingIn)

**入口**: `src/statusBar.ts:430-436`

**显示**: `$(loading~spin) 登录中...`

#### 3.7.9 登录过期 (showLoginExpired)

**入口**: `src/statusBar.ts:441-447`

**显示**: `$(warning) 登录已过期`

**特点**:
- 黄色背景
- 命令改为 `googleLogin`（点击重新登录）

#### 3.7.10 数据过时 (showStale)

**入口**: `src/statusBar.ts:453-493`

**显示**: `⚠️ 🟢 Claude: 85%`（在原显示前添加警告图标）

**实现**:

1. **恢复配额显示** (`src/statusBar.ts:455-461`)
   - 如果正在刷新，先恢复到上次的配额显示
   - 调用 `rebuildDisplayFromSnapshot()`

2. **添加过时图标** (`src/statusBar.ts:469-474`)
   - 在文本前添加 `⚠️`
   - 避免重复添加

3. **更新 Tooltip** (`src/statusBar.ts:476-491`)
   - 在 Tooltip 开头添加过时警告
   - 使用 `hasStaleWarning` 标志避免重复

### 3.8 辅助方法

#### 3.8.1 模型 Emoji (getModelEmoji)

**入口**: `src/statusBar.ts:281-295`

| 模型 | Emoji |
|------|-------|
| Claude | 🔥 |
| Gemini Flash | ⚡ |
| Gemini Pro | 💎 |
| GPT | 🤖 |
| 其他 | 🌟 |

#### 3.8.2 短名称 (getShortModelName)

**入口**: `src/statusBar.ts:297-314`

| 完整名称 | 短名称 |
|---------|--------|
| Claude 3.5 Sonnet | Claude |
| Gemini 3.5 Flash | G Flash |
| Gemini 3.5 Pro (Low) | G Pro |
| GPT-4 | GPT |

#### 3.8.3 计划名称格式化 (formatPlanName)

**入口**: `src/statusBar.ts:346-349`

**实现**: 直接返回原始名称（不做转换）

## 4. Design Rationale

### 最小动画时长
- **原因**: 避免刷新动画闪烁，提升用户体验
- **实现**: 快速刷新至少显示 1 秒

### 模型选择逻辑
- **原因**: 状态栏空间有限，只显示最重要的模型
- **实现**: Claude 必显，Gemini 可配置

### 状态指示符颜色
- **原因**: 直观表示配额状态，快速识别
- **实现**: 绿/黄/红/黑四色系统

### 三种显示风格
- **原因**: 满足不同用户的偏好
- **实现**: 百分比（精确）、进度条（直观）、圆点（简洁）

### Tooltip 详细信息
- **原因**: 状态栏空间有限，Tooltip 提供完整信息
- **实现**: Markdown 表格格式

### 过时标记保留显示
- **原因**: 临时网络问题不应清空配额显示
- **实现**: 添加警告图标，保留上次数据

### 点击行为动态切换
- **原因**: 不同状态下点击应有不同行为
- **实现**: 动态修改 `statusBarItem.command`
  - 正常: `quickRefreshQuota`（刷新）
  - 错误: `refreshQuota`（重试）
  - 未登录: `googleLogin`（登录）

### 国际化支持
- **原因**: 支持多语言用户
- **实现**: 所有文本通过 `LocalizationService.t()` 获取
