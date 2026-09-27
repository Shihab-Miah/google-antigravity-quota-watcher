# <img src="./icon.png" width="64" style="vertical-align: middle"> Google Antigravity Quota Watcher

**Real-time AI model quota monitoring for Google Antigravity — live status bar indicators, usage forecasting, and automatic Google Sheets history.**

---

## Features

- 📊 **Live Status Bar** — See your Claude, Gemini Pro, and Gemini Flash quota at a glance, right in the VS Code status bar
- 💡 **Bulb Mode** — Unique light-bulb display that transitions from bright yellow → orange → red as quota depletes
- 🔮 **Depletion Forecasting** — Linear regression over your usage history tells you exactly when a model will run out
- 🧠 **Local Failsafe Engine** — If the Antigravity API is temporarily unreachable, the extension estimates your current quota from local history and flags it as `[EST]` so you're never left in the dark
- 📈 **Google Sheets History** — Automatically logs every quota snapshot to a private spreadsheet in your own Google Drive (100% free, no backend costs, your data stays yours)
- 🔔 **Critical Alerts** — VS Code popup notifications when any model hits the critical or depleted threshold
- 🔐 **Google OAuth Login** — Secure authentication using your Google account; no passwords stored anywhere

---

## Installation

### From a `.vsix` file (local install)

1. Open the **Extensions** panel in VS Code (`Ctrl+Shift+X`)
2. Click the **`...`** menu at the top right of the panel
3. Select **Install from VSIX...**
4. Pick the `google-antigravity-quota-watcher-*.vsix` file

---

## Getting Started

1. After installing, open the VS Code command palette (`Ctrl+Shift+P`)
2. Run **Google Antigravity Quota Watcher: Login with Google**
3. Complete the OAuth flow in your browser
4. The quota display will appear in your status bar automatically

---

## Display Styles

You can change the display style in Settings under **Google Antigravity Quota Watcher**:

| Style | Example |
|-------|---------|
| `percentage` | 🟢 Claude: 85% |
| `progressBar` | 🟢 Claude ███████░ |
| `dots` | 🟢 Claude ●●●●○ |
| `bulbs` | 💡💡💡💡🔴 *(yellow → red as quota drops)* |

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | `true` | Enable auto-monitoring |
| `pollingInterval` | `60` | How often to fetch quota (seconds) |
| `displayStyle` | `percentage` | Status bar display format |
| `apiMethod` | `GOOGLE_API` | API method to use |
| `warningThreshold` | `50` | % below which the indicator turns orange |
| `criticalThreshold` | `30` | % below which the indicator turns red |
| `showPlanName` | `false` | Show account tier (Free / Pro) |
| `showGeminiPro` | `true` | Show Gemini Pro quota |
| `showGeminiFlash` | `true` | Show Gemini Flash quota |

---

## Google Sheets History

When you log in with Google, the extension automatically creates a spreadsheet called **"Antigravity Quota History"** in your Google Drive. Every successful quota fetch is appended as a row — `Timestamp`, `Model`, `Remaining %`, `Plan`. Estimated/failsafe data is never written to the sheet.

You own this spreadsheet. You can delete it, share it, or build your own charts from it at any time.

---

## How the Failsafe Works

The extension maintains a rolling 24-hour buffer of your last quota snapshots in VS Code's secure local state. If an API call fails (network issue, server timeout), it uses linear regression across the buffer to estimate where your quota should be right now based on your usage rate. The status bar shows `$(graph) [EST]` with a yellow background to make it obvious you're looking at estimated data.

---

## Privacy

- **No data is sent to any third-party server.** All quota data stays between you, the Google Antigravity API, and (optionally) your own Google Drive spreadsheet.
- Your Google access token is stored using VS Code's built-in `SecretStorage` API (the OS keychain).
- The `drive.file` OAuth scope grants access only to files this extension creates — not your entire Drive.

---

## Author

Built by **Shihab Miah** — based on the open-source Antigravity Quota Watcher project.

Licensed under the MIT License.
