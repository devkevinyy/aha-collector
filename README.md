<div align="center">

# Aha Collector

### Capture insights from the web, save to Feishu Bitable

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-green?logo=google-chrome)](https://chrome.google.com/webstore)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-black?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)

[Features](#-features) • [Installation](#-installation) • [Configuration](#-configuration) • [Usage](#-usage) • [Development](#-development)

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Quick Capture** | Save tweets, Reddit posts, and any web content with one click |
| **Video Timestamps** | Capture moments from YouTube/Bilibili with automatic subtitle extraction |
| **Multi-Table Support** | Configure multiple Bitable tables and choose where to save |
| **Markdown Editor** | Edit content in side panel with live preview |
| **Privacy First** | All credentials stored locally, never uploaded to any server |

## 🌐 Supported Platforms

| Platform | Content Capture | Video Timestamps |
|----------|:---------------:|:----------------:|
| **X / Twitter** | ✅ Posts with links | - |
| **Reddit** | ✅ Posts & comments | - |
| **YouTube** | ✅ | ✅ with subtitles |
| **Bilibili** | ✅ | ✅ with subtitles |
| **Any Website** | ✅ via selection | - |

## 📁 Project Structure

```
aha-collector/
├── public/
│   ├── manifest.json         # Chrome extension manifest
│   └── icons/                # Extension icons
├── src/
│   ├── api/
│   │   └── feishu.ts         # Feishu/Lark API client
│   ├── background/
│   │   └── index.ts          # Service worker
│   ├── content/
│   │   └── index.ts          # Content scripts (X/Reddit injection)
│   ├── options/
│   │   └── main.tsx          # Settings page
│   ├── sidepanel/
│   │   └── main.tsx          # Main UI: capture & edit
│   ├── styles/
│   │   └── globals.css       # Global styles
│   └── ...
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 🔒 How Credentials Are Stored

All credentials are stored locally using **`chrome.storage.local`**:

| Credential | Storage | Sync |
|------------|---------|------|
| App ID | `chrome.storage.local` | ❌ No |
| App Secret | `chrome.storage.local` | ❌ No |
| App Tokens | `chrome.storage.local` | ❌ No |
| Table IDs | `chrome.storage.local` | ❌ No |

### Storage Characteristics

- **Location**: User's local browser (Chrome Extension local storage)
- **Cloud Sync**: Disabled — data stays on your device
- **Capacity**: ~10MB limit per extension
- **Persistence**: Remains until extension is uninstalled or manually cleared
- **Privacy**: Completely local — no data uploaded to any server

### View Stored Data (Debugging)

```javascript
// Chrome DevTools Console → Service Worker
chrome.storage.local.get('feishuConfig', console.log)
```

## 🚀 Installation

### From Chrome Web Store

> Coming soon...

### Manual Installation (Development)

```bash
# Clone the repository
git clone https://github.com/devkevinyy/aha-collector.git
cd aha-collector

# Install dependencies
npm install

# Build the extension
npm run build

# Load in Chrome
# 1. Navigate to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the `dist/` folder
```

## ⚙️ Configuration

### Step 1: Create a Feishu App

Before using the extension, you need to create a self-built app:

1. **Navigate to [Feishu Open Platform](https://open.feishu.cn/app)**
   - Log in with your Feishu account

2. **Create a New App**
   - Click "Create App" (创建自建应用)
   - Select "Enterprise Self-Built App" (企业自建应用)
   - Enter app name (e.g., "Aha Collector")
   - Select your organization

3. **Get Credentials**
   - Go to "Credentials" (凭证与基础信息)
   - Copy **App ID** — format: `cli_xxxxxxxxx`
   - Copy **App Secret** — click "Show" to reveal
   - ⚠️ Keep your App Secret secure!

4. **Configure Permissions**
   - Go to "Permissions" (权限管理)
   - Add: `bitable:app` — Access and manage Bitable
   - Save and publish the app

5. **Authorize Your Bitable**
   - Open your Bitable document
   - Click menu (⋯) → "Add document app" (添加文档应用)
   - Select your app and grant "Edit" (可编辑) permission

📖 **Reference**: [Feishu Official Guide](https://open.feishu.cn/document/quick-access-to-base/step-1-create-and-configure-an-application)

### Step 2: Extract App Token & Table ID

From your Feishu Bitable URL:

```
https://my.feishu.cn/base/TE4db3rogaBlwpsXUcLcuiCynIh?table=tblJlhpECMbauEnA&view=vewajB77CO
                     ^^^^^^^^^^^^^^^^^^^^^^^^              ^^^^^^^^^^^^^^
                     App Token                            Table ID
```

| Part | Value | Description |
|------|-------|-------------|
| **App Token** | Segment after `/base/` | `TE4db3rogaBlwpsXUcLcuiCynIh` |
| **Table ID** | Value after `table=` | `tblJlhpECMbauEnA` |

### Step 3: Configure Extension

1. Click the extension icon → **Options**
2. Enter your **App ID** and **App Secret**
3. Add your tables:
   - Table Name (e.g., "Reading List")
   - App Token (from Step 2)
   - Table ID (from Step 2)
4. Click **Save Configurations**

## 📖 Usage

### Quick Capture (X/Twitter, Reddit)

1. Browse X/Twitter or Reddit
2. Click the **"Save"** button below any post
3. Content is automatically added to the side panel

### Video Timestamps (YouTube, Bilibili)

1. Open a video on YouTube or Bilibili
2. Click **"Aha"** when you see something interesting
3. Video pauses — timestamp + subtitle are captured
4. Click **"Resume"** to continue watching

### Manual Capture

1. Open the side panel (extension icon)
2. Edit content in Markdown
3. Select target table (if multiple configured)
4. Click **"Save"**

## 🔧 Bitable Fields

Ensure your Bitable table has these text fields:

| Field | Description | Example |
|-------|-------------|---------|
| **Title** | Page title or post title | "Aha Collector - Project Ideas" |
| **URL** | Source URL | `https://youtube.com/watch?v=xxx` |
| **Content** | Markdown content | `## Notes\n\n- Point 1\n- Point 2` |
| **Date** | Capture date (ISO) | `2026-04-18` |

## 🛠️ Development

```bash
# Install dependencies
npm install

# Development mode with hot reload
npm run dev

# Production build
npm run build

# Run linter
npm run lint

# Preview production build
npm run preview
```

### Tech Stack

- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vite.dev/)
- **HTTP Client**: [Axios](https://axios-http.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Markdown**: [react-markdown](https://github.com/remarkjs/react-markdown)
- **Platform**: Chrome Extension Manifest V3

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Feishu Open Platform](https://open.feishu.cn/) for the API
- [Vite](https://vite.dev/) for the blazing fast build tool
- [Lucide](https://lucide.dev/) for the beautiful icons

---

<div align="center">

**Made with ❤️ for personal knowledge management**

[⬆ Back to Top](#-aha-collector)

</div>
