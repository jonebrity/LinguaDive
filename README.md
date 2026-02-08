# LinguaDive

[简体中文](#简体中文) | [English](#english)

---

<a name="简体中文"></a>
## 简体中文

### 简介

LinguaDive 是一款支持 Chrome 和 Edge 浏览器的扩展插件，提供沉浸式学习体验。它可以对网页上选中的文本进行翻译、解释和总结，并构建你的个人知识库。

### 核心功能

- **浮动工具条**：选中网页上的任意文本，触发浮动工具条，快速执行操作
- **翻译（译）**：翻译选中文本，结合上下文分析深层含义
- **解释（释）**：用通俗易懂的语言解释单词、短语、句子或段落
- **总结（炼）**：根据文本长度智能提取核心要点和关键信息
- **收藏（藏）**：将选中文本保存到个人知识库
- **知识库（库）**：分类管理所有记录，支持搜索和导出功能

### 特色功能

- **多 AI 服务商支持**：支持 OpenAI、Claude、DeepSeek 及自定义 OpenAI 兼容 API
- **按功能配置 API**：可为不同功能指定不同的 AI 服务商
- **快捷开关**：使用可自定义的快捷键启用/停用插件（默认：Shift+L）
- **上下文感知**：自动捕获周围上下文，提升 AI 理解准确度
- **批量删除**：知识库支持多选批量删除记录

### 安装方法

1. 下载或克隆本仓库
2. 打开 Chrome/Edge 浏览器，访问 `chrome://extensions/` 或 `edge://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"，选择项目文件夹
5. LinguaDive 图标将出现在浏览器工具栏中

### 配置说明

1. 点击工具栏中的 LinguaDive 图标
2. 进入设置页面配置 AI API：
   - 选择 API 提供商（OpenAI、Claude、DeepSeek 或自定义）
   - 输入 API Key
   - 可选：设置自定义 Base URL 和模型
   - 选择每个 API 用于哪些功能

### 使用方法

1. 在网页上选中任意文本
2. 浮动工具条将显示 5 个按钮：
   - **译**：获取翻译和上下文分析
   - **释**：获取通俗解释
   - **炼**：获取总结和关键点
   - **藏**：保存到知识库
   - **库**：打开知识库
3. 按 `Shift+L`（或自定义快捷键）可快速启用/停用插件

### 技术栈

- Manifest V3（Chrome/Edge 通用）
- 原生 JavaScript + HTML + CSS
- Chrome Storage API
- 多 AI API 集成

### 开源协议

MIT License

---

<a name="english"></a>
## English

### Introduction

LinguaDive is a browser extension for Chrome and Edge that provides an immersive learning experience. It allows you to translate, explain, and summarize selected text on any webpage, and build your personal knowledge base.

### Features

- **Floating Toolbar**: Select any text on a webpage to trigger a floating toolbar with quick action buttons
- **Translation (译)**: Translate selected text with context-aware deep meaning analysis
- **Explanation (释)**: Get easy-to-understand explanations for words, phrases, sentences, or paragraphs
- **Summary (炼)**: Extract key points and summarize long content intelligently based on text length
- **Collection (藏)**: Save selected text to your personal knowledge base
- **Knowledge Base (库)**: Manage all your saved records with categorized tabs, search, and export features

### Additional Features

- **Multiple AI Providers**: Support for OpenAI, Claude, DeepSeek, and custom OpenAI-compatible APIs
- **Per-function API Configuration**: Assign different AI providers to different functions
- **Quick Toggle**: Enable/disable the extension with customizable keyboard shortcut (default: Shift+L)
- **Context-aware**: Automatically captures surrounding context for better AI understanding
- **Multi-select Delete**: Batch delete records in the knowledge base

### Installation

1. Download or clone this repository
2. Open Chrome/Edge and navigate to `chrome://extensions/` or `edge://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the project folder
5. The LinguaDive icon will appear in your browser toolbar

### Configuration

1. Click the LinguaDive icon in the toolbar
2. Go to Settings to configure your AI API:
   - Select API provider (OpenAI, Claude, DeepSeek, or Custom)
   - Enter your API Key
   - Optionally set custom Base URL and model
   - Choose which functions to use with each API

### Usage

1. Select any text on a webpage
2. A floating toolbar will appear with 5 buttons:
   - **译** (Translate): Get translation with context analysis
   - **释** (Explain): Get easy explanation
   - **炼** (Summarize): Get summary and key points
   - **藏** (Collect): Save to knowledge base
   - **库** (Library): Open knowledge base
3. Press `Shift+L` (or your custom shortcut) to toggle the extension on/off

### Tech Stack

- Manifest V3 (Chrome/Edge compatible)
- Vanilla JavaScript + HTML + CSS
- Chrome Storage API
- Multiple AI API integrations

### License

MIT License
