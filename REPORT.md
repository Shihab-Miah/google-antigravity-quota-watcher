# Antigravity Quota Watcher - Codebase Review Report

This report outlines bugs, design problems, platform-specific limitations, and unimplemented features identified in the `google-antigravity-quota-watcher` repository.

## 1. Features that May Not Work in Real IDE Platforms
* **Hardcoded `ideName` in API Requests**: In `src/quota/quotaService.ts`, the `GetUserStatus` request payload hardcodes `ideName` and `extensionName` to `"antigravity"`. While the actual IDE might be VS Code (e.g., `vscode.env.appName` is "Visual Studio Code"), sending `"antigravity"` is technically a spoof to satisfy the local Antigravity server. However, if the server expects the *actual* IDE name, this might cause issues.
* **Database Path Constraints**: In `src/auth/antigravityTokenExtractor.ts`, `hasAntigravityDb()` and `extractRefreshTokenFromAntigravity()` rely on strict platform-specific paths (e.g., `Library/Application Support/Antigravity/User/globalStorage/state.vscdb` on macOS). If a user uses the extension on a different platform or IDE (like standard VS Code) but expects it to pick up the token from an Antigravity installation located elsewhere, it will fail.
* **Process Detection Assumptions**: `src/platform/platformDetector.ts` expects process names like `language_server_windows_x64.exe` or `language_server_macos`. If the underlying tools rename these binaries or if the user is running an alternative language server, port detection will fail.

## 2. Broken Features and Discrepancies
* **`bulbs` Display Style Missing**:
  - `package.json` documents `bulbs` as an available `displayStyle` enum (e.g. `"Show light bulbs — bulbs change from yellow to red as quota drops (e.g. 💡💡💡💡🔴)"`).
  - However, in `src/types.ts`, `displayStyle` uses `'stars'` instead of `'bulbs'`.
  - In `src/ui/statusBar.ts`, a `getStarsBar()` method is implemented, but there is no `getBulbsBar()` method. Therefore, the "Bulbs Mode" described in `README.md` is fundamentally broken and cannot be selected/displayed correctly based on user configuration.
* **Prompt Credits Display Inconsistent**:
  - `showPromptCredits` configuration exists, but the Webview Panel (`src/ui/webviewPanel.ts`) has manually commented out the HTML for `promptCreditsRow` (`<!-- 暂时隐藏提示词额度 -->`), even though the TypeScript logic is still partially there. This results in a disconnected feature where configuration exists but the dashboard UI deliberately hides it.
* **Unused Variables and Linter Warnings**:
  - `src/api/weeklyLimitChecker.ts` assigns `result` but never uses it.
  - `src/failsafe/localQuotaTracker.ts` defines `QuotaHistoryEntry` and `DepletionForecast` but never uses them.
  - `src/failsafe/quotaHistory.ts` defines `ModelQuotaInfo` but never uses it.

## 3. Design Problems
* **Lack of Context/Extensibility in Error Notifications**: Many VS Code notification alerts pop up silently without an obvious resolution flow. For example, `notify.unableToDetectPort` prompts for multiple reasons (1-4) in a single block instead of dynamically checking the actual reason, which can overwhelm the user.
* **Error Handling for `process.env.APPDATA`**: In Windows environments, relying on `process.env.APPDATA` might return an empty string if unset, causing `path.join` to form an invalid absolute path starting from the root instead of providing a graceful failure.
* **Dashboard Data Model Coupling**: The dashboard UI logic (`src/ui/webviewPanel.ts`) is heavily coupled with the extension's string concatenation (e.g. parsing `Gemini 3 Pro Image`), making it brittle to model name changes from the Google API.

## Recommendations
1. Fix the `bulbs` vs `stars` discrepancy by updating `src/types.ts` and implementing `getBulbsBar` in `src/ui/statusBar.ts`.
2. Fix all `eslint` warnings by removing unused variables.
3. Decouple hardcoded platform paths by allowing users to configure the Antigravity `vscdb` location if it's not found in default locations.
4. Clean up commented-out code (like `promptCredits`) if it is permanently deprecated, or fully implement it if it is a work-in-progress.
