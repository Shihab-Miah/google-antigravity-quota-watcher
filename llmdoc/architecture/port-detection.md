# Port Detection

## 1. Identity

- **What it is:** 端口检测机制，用于自动发现 Antigravity 语言服务器的端口和 CSRF Token。
- **Purpose:** 实现本地 API 方法的自动配置，无需用户手动输入。

## 2. Core Components

- `src/portDetectionService.ts` (PortDetectionService): 端口检测服务
- `src/processPortDetector.ts` (ProcessPortDetector): 进程检测器（跨平台）
- `src/windowsProcessDetector.ts` (WindowsProcessDetector): Windows 进程检测
- `src/unixProcessDetector.ts` (UnixProcessDetector): Unix/Linux/macOS 进程检测
- `src/platformDetector.ts` (PlatformDetector): 平台检测

## 3. Execution Flow (LLM Retrieval Map)

### 3.1 端口检测入口

**入口**: `src/portDetectionService.ts:34-57`

**执行步骤**:

1. **调用进程检测器** (`src/portDetectionService.ts:38`)
   - 调用 `processDetector.detectProcessInfo()`
   - 返回 `AntigravityProcessInfo` 或 null

2. **检测失败处理** (`src/portDetectionService.ts:40-44`)
   - 记录错误日志
   - 返回 null

3. **检测成功处理** (`src/portDetectionService.ts:46-56`)
   - 记录成功日志（遮蔽 CSRF Token）
   - 构建 `PortDetectionResult`:
     - `port`: connectPort（主端口）
     - `connectPort`: HTTPS 端口
     - `httpPort`: HTTP 备用端口
     - `csrfToken`: CSRF Token
     - `source`: "process"
     - `confidence`: "high"

### 3.2 进程检测器 (ProcessPortDetector)

**入口**: `src/processPortDetector.ts`

**平台选择**: `src/processPortDetector.ts:constructor`

1. **检测平台** (`src/platformDetector.ts`)
   - 调用 `PlatformDetector.detect()`
   - 返回 `Platform` 枚举（WINDOWS / MACOS / LINUX / UNKNOWN）

2. **创建对应的检测器**:
   - **Windows**: `WindowsProcessDetector`
   - **macOS/Linux**: `UnixProcessDetector`

**检测流程**: `src/processPortDetector.ts:detectProcessInfo`

1. **调用平台检测器** (`src/processPortDetector.ts`)
   - 调用 `detector.detectAntigravityProcess()`
   - 返回进程信息或 null

2. **解析进程参数** (`src/processPortDetector.ts`)
   - 从命令行参数中提取：
     - `--connect-port=<port>`: HTTPS 端口
     - `--extension-server-port=<port>`: HTTP 端口
     - `--csrf-token=<token>`: CSRF Token

3. **返回结果** (`src/processPortDetector.ts`)
   - 返回 `AntigravityProcessInfo { connectPort, extensionPort, csrfToken }`

### 3.3 Windows 进程检测

**入口**: `src/windowsProcessDetector.ts`

**检测方法**: 两种方式，按优先级尝试

#### 3.3.1 方法 1: netstat (默认)

**命令**: `netstat -ano | findstr LISTENING`

**执行步骤**: `src/windowsProcessDetector.ts:detectAntigravityProcess`

1. **执行 netstat** (`src/windowsProcessDetector.ts`)
   - 获取所有监听端口和对应的 PID
   - 解析输出，提取 PID 列表

2. **获取进程命令行** (`src/windowsProcessDetector.ts`)
   - 对每个 PID，执行 `wmic process where ProcessId=<pid> get CommandLine`
   - 或使用 PowerShell: `Get-CimInstance Win32_Process -Filter "ProcessId=<pid>"`

3. **匹配 Antigravity 进程** (`src/windowsProcessDetector.ts`)
   - 检查命令行是否包含 "language_server"
   - 检查是否包含 "--connect-port" 参数

4. **解析参数** (`src/windowsProcessDetector.ts`)
   - 提取 `--connect-port`
   - 提取 `--extension-server-port`
   - 提取 `--csrf-token`

#### 3.3.2 方法 2: PowerShell (备用)

**命令**: `Get-Process | Where-Object { $_.ProcessName -like '*language_server*' }`

**配置**: `antigravityQuotaWatcher.forcePowerShell`

**执行步骤**: 类似方法 1，但直接使用 PowerShell 获取进程信息

### 3.4 Unix/Linux/macOS 进程检测

**入口**: `src/unixProcessDetector.ts`

**检测方法**: 三种方式，按优先级尝试

#### 3.4.1 方法 1: lsof (推荐)

**命令**: `lsof -iTCP -sTCP:LISTEN -n -P`

**优势**: 最可靠，直接获取端口和进程信息

**执行步骤**: `src/unixProcessDetector.ts`

1. **执行 lsof** (`src/unixProcessDetector.ts`)
   - 获取所有监听的 TCP 端口
   - 解析输出，提取 PID 和端口

2. **获取进程命令行** (`src/unixProcessDetector.ts`)
   - 对每个 PID，读取 `/proc/<pid>/cmdline`（Linux）
   - 或执行 `ps -p <pid> -o command=`（macOS）

3. **匹配和解析** (`src/unixProcessDetector.ts`)
   - 检查命令行是否包含 "language_server"
   - 提取端口和 Token 参数

#### 3.4.2 方法 2: netstat (备用)

**命令**: `netstat -tulnp` (Linux) 或 `netstat -an` (macOS)

**执行步骤**: 类似 lsof，但输出格式不同

#### 3.4.3 方法 3: ss (现代替代)

**命令**: `ss -tulnp`

**优势**: 比 netstat 更快，现代 Linux 系统推荐

**执行步骤**: 类似 lsof

### 3.5 参数解析

**入口**: `src/processPortDetector.ts:parseProcessArgs`

**支持的参数格式**:

1. **等号分隔**: `--connect-port=42100`
2. **空格分隔**: `--connect-port 42100`
3. **引号包裹**: `--csrf-token="abc123"`

**解析步骤**:

1. **分割命令行** (`src/processPortDetector.ts`)
   - 按空格分割
   - 处理引号内的空格

2. **提取参数** (`src/processPortDetector.ts`)
   - 遍历参数列表
   - 匹配 `--connect-port`、`--extension-server-port`、`--csrf-token`
   - 提取值（处理等号和空格两种格式）

3. **返回结果** (`src/processPortDetector.ts`)
   - 返回 `{ connectPort, extensionPort, csrfToken }`

### 3.6 错误处理

**常见错误**:

1. **命令不存在**
   - Windows: netstat 或 PowerShell 不可用
   - Linux: lsof/netstat/ss 都不存在
   - **解决**: 提示用户安装或切换到 GOOGLE_API 方法

2. **权限不足**
   - Windows: 无法获取进程命令行
   - Linux: 无法读取 /proc/<pid>/cmdline
   - **解决**: 提示以管理员/root 权限运行

3. **进程未运行**
   - Antigravity 语言服务器未启动
   - **解决**: 提示用户启动 Antigravity 或重启 IDE

4. **参数格式变化**
   - Antigravity 更新后参数格式改变
   - **解决**: 更新解析逻辑或切换到 GOOGLE_API 方法

## 4. Design Rationale

### 跨平台支持
- **原因**: 支持 Windows、macOS、Linux 三大平台
- **实现**: 策略模式，根据平台选择不同的检测器

### 多种检测方法
- **原因**: 不同系统可能缺少某些命令
- **实现**: 按优先级尝试多种方法，直到成功

### 从进程参数提取
- **原因**: 端口和 Token 是动态分配的，无法硬编码
- **实现**: 解析进程命令行参数

### CSRF Token 遮蔽
- **原因**: 避免在日志中泄露敏感信息
- **实现**: 只显示前 6 位和后 4 位

### 端口范围限制
- **原因**: Antigravity 通常使用 42100-42200 范围
- **实现**: 过滤端口范围，减少误匹配

### 双端口支持
- **原因**: HTTPS 可能失败，需要 HTTP 备用
- **实现**: 同时提取 connectPort 和 extensionPort
