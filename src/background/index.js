/**
 * LinguaDive - Background Service Worker
 * 处理扩展的后台逻辑，包括消息通信、右键菜单等
 */

// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  // 先移除已存在的菜单项，避免重复创建错误
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'linguadive-translate',
      title: '使用 LinguaDive 翻译',
      contexts: ['selection']
    });
  });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'linguadive-translate' && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'translate',
      text: info.selectionText
    });
  }
});

// 监听来自 content script 或 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'callAI') {
    handleAIRequest(request.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'openOptions') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return false;
  }

  if (request.action === 'openKnowledge') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/knowledge/index.html') });
    sendResponse({ success: true });
    return false;
  }

  if (request.action === 'getApiConfigs') {
    chrome.storage.sync.get(['apiConfigs', 'currentApiIndex'], (result) => {
      sendResponse({
        success: true,
        data: {
          configs: result.apiConfigs || [],
          currentIndex: result.currentApiIndex || 0
        }
      });
    });
    return true;
  }

  if (request.action === 'testAPI') {
    testAPIConnection(request.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'getPluginState') {
    chrome.storage.sync.get(['pluginEnabled', 'shortcutKey'], (result) => {
      sendResponse({
        success: true,
        data: {
          enabled: result.pluginEnabled !== false,
          shortcutKey: result.shortcutKey || 'Shift+L'
        }
      });
    });
    return true;
  }

  if (request.action === 'updatePluginState') {
    // 通知所有标签页更新状态
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'pluginStateChanged',
          enabled: request.enabled
        }).catch(() => {});
      });
    });
    sendResponse({ success: true });
    return false;
  }

  if (request.action === 'togglePlugin') {
    chrome.storage.sync.get(['pluginEnabled'], async (result) => {
      const newState = result.pluginEnabled === false;
      await chrome.storage.sync.set({ pluginEnabled: newState });

      // 通知所有标签页更新状态
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'pluginStateChanged',
            enabled: newState
          }).catch(() => {});
        });
      });

      sendResponse({ success: true, enabled: newState });
    });
    return true;
  }
});

/**
 * 处理 AI API 请求
 * @param {Object} data - 请求数据
 * @returns {Promise<Object>} AI 响应结果
 */
async function handleAIRequest(data) {
  const { apiConfigs } = await getApiConfigs();
  const { text, context, type } = data;

  if (apiConfigs.length === 0) {
    throw new Error('请先在设置中配置 API');
  }

  // 根据功能类型选择合适的 API
  const config = findApiForType(apiConfigs, type || 'translate');

  if (!config) {
    throw new Error(`没有配置用于"${getTypeName(type)}"功能的 API`);
  }

  if (!config.apiKey) {
    throw new Error('API Key 未配置');
  }

  const { provider, apiKey, baseUrl, model } = config;

  // 根据类型选择不同的提示词
  let prompt;
  switch (type) {
    case 'explain':
      prompt = buildExplainPrompt(text, context);
      break;
    case 'summarize':
      prompt = buildSummarizePrompt(text, context);
      break;
    case 'translate':
    default:
      prompt = buildTranslationPrompt(text, context);
      break;
  }

  switch (provider) {
    case 'openai':
      return callOpenAI(baseUrl || 'https://api.openai.com/v1', apiKey, model || 'gpt-3.5-turbo', prompt);
    case 'claude':
      return callClaude(baseUrl || 'https://api.anthropic.com', apiKey, model || 'claude-3-haiku-20240307', prompt);
    case 'deepseek':
      return callOpenAI(baseUrl || 'https://api.deepseek.com/v1', apiKey, model || 'deepseek-chat', prompt);
    case 'custom':
      return callOpenAI(baseUrl, apiKey, model, prompt);
    default:
      throw new Error('未知的 API 提供商');
  }
}

/**
 * 根据功能类型查找合适的 API 配置
 */
function findApiForType(apiConfigs, type) {
  const typeKey = {
    'translate': 'useForTranslate',
    'explain': 'useForExplain',
    'summarize': 'useForSummarize'
  }[type] || 'useForTranslate';

  // 优先查找明确启用该功能的 API
  let config = apiConfigs.find(c => c[typeKey] === true);

  // 如果没找到，查找没有设置功能限制的 API（兼容旧配置）
  if (!config) {
    config = apiConfigs.find(c => c[typeKey] !== false);
  }

  return config;
}

/**
 * 获取功能类型名称
 */
function getTypeName(type) {
  const names = {
    'translate': '翻译',
    'explain': '解释',
    'summarize': '总结'
  };
  return names[type] || '翻译';
}

/**
 * 测试 API 连接（直接使用传入的配置）
 */
async function testAPIConnection(config) {
  const { provider, apiKey, baseUrl, model } = config;

  if (!apiKey) {
    throw new Error('API Key 未配置');
  }

  const prompt = buildTranslationPrompt('hello', 'This is a test.');

  switch (provider) {
    case 'openai':
      return callOpenAI(baseUrl || 'https://api.openai.com/v1', apiKey, model || 'gpt-3.5-turbo', prompt);
    case 'claude':
      return callClaude(baseUrl || 'https://api.anthropic.com', apiKey, model || 'claude-3-haiku-20240307', prompt);
    case 'deepseek':
      return callOpenAI(baseUrl || 'https://api.deepseek.com/v1', apiKey, model || 'deepseek-chat', prompt);
    case 'custom':
      if (!baseUrl) {
        throw new Error('自定义提供商需要填写 API Base URL');
      }
      return callOpenAI(baseUrl, apiKey, model, prompt);
    default:
      throw new Error('未知的 API 提供商');
  }
}

/**
 * 获取 API 配置列表
 * @returns {Promise<Object>} API 配置
 */
async function getApiConfigs() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['apiConfigs', 'currentApiIndex'], (result) => {
      resolve({
        apiConfigs: result.apiConfigs || [],
        currentApiIndex: result.currentApiIndex || 0
      });
    });
  });
}

/**
 * 构建翻译提示词
 * @param {string} text - 要翻译的文本
 * @param {string} context - 上下文
 * @returns {string} 提示词
 */
function buildTranslationPrompt(text, context) {
  return `你是一个专业的翻译助手。请翻译以下单词或短语，并结合上下文分析其深层含义。

要翻译的内容：${text}

上下文：${context || '无'}

请按以下格式返回（使用 JSON 格式）：
{
  "translation": "基本翻译",
  "meaning": "结合上下文的深层含义分析",
  "examples": ["例句1", "例句2"]
}

只返回 JSON，不要有其他内容。`;
}

/**
 * 构建解释提示词
 * @param {string} text - 要解释的文本
 * @param {string} context - 上下文
 * @returns {string} 提示词
 */
function buildExplainPrompt(text, context) {
  return `你是一个知识渊博的助手。请结合上下文，用通俗易懂的语言解释以下内容。内容可能是中文、英文或混合内容，可能是单词、短语、句子或段落。

要解释的内容：${text}

上下文：${context || '无'}

请按以下格式返回（使用 JSON 格式）：
{
  "explanation": "通俗易懂的解释",
  "background": "相关背景知识（如果有的话，没有则留空）"
}

只返回 JSON，不要有其他内容。`;
}

/**
 * 构建总结提示词
 * @param {string} text - 要总结的文本
 * @param {string} context - 上下文
 * @returns {string} 提示词
 */
function buildSummarizePrompt(text, context) {
  const textLength = text.length;

  // 根据文本长度动态调整要求
  let summaryRequirement;
  let keyPointsRequirement;

  if (textLength < 500) {
    summaryRequirement = '2-3句话概括核心内容';
    keyPointsRequirement = '3-5个关键点';
  } else if (textLength < 2000) {
    summaryRequirement = '一段话（100-200字）概括核心内容';
    keyPointsRequirement = '5-8个关键点';
  } else if (textLength < 5000) {
    summaryRequirement = '一段话（200-400字）概括核心内容，涵盖主要论点';
    keyPointsRequirement = '8-12个关键点，按重要性排序';
  } else if (textLength < 20000) {
    summaryRequirement = '2-3段话（400-800字）系统概括核心内容，包含主要论点和结论';
    keyPointsRequirement = '12-20个关键点，可按主题分组';
  } else {
    summaryRequirement = '3-5段话（800-1500字）全面概括核心内容，包含背景、主要论点、论据和结论';
    keyPointsRequirement = '20-30个关键点，按主题或章节分组';
  }

  return `你是一个专业的内容分析助手。请对以下内容进行深入分析和总结提炼。

要总结的内容（共${textLength}字）：
${text}

${context ? `上下文（供参考）：${context}` : ''}

请按以下要求进行总结：
1. 核心要点：${summaryRequirement}
2. 关键点：提取${keyPointsRequirement}，每个关键点应该是完整的信息点，不要过于简略

请按以下格式返回（使用 JSON 格式）：
{
  "summary": "核心要点总结",
  "keyPoints": ["关键点1", "关键点2", ...]
}

只返回 JSON，不要有其他内容。`;
}

/**
 * 调用 OpenAI 兼容 API
 */
async function callOpenAI(baseUrl, apiKey, model, prompt) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API 请求失败: ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  try {
    return JSON.parse(content);
  } catch {
    return { translation: content, meaning: '', examples: [] };
  }
}

/**
 * 调用 Claude API
 */
async function callClaude(baseUrl, apiKey, model, prompt) {
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API 请求失败: ${error}`);
  }

  const data = await response.json();
  const content = data.content[0].text;

  try {
    return JSON.parse(content);
  } catch {
    return { translation: content, meaning: '', examples: [] };
  }
}
