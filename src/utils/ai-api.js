/**
 * LinguaDive - AI API Utils
 * AI API 调用封装
 */

/**
 * AI 服务商配置
 */
export const AI_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-3.5-turbo'
  },
  claude: {
    name: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-haiku-20240307'
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat'
  },
  custom: {
    name: '自定义',
    baseUrl: '',
    defaultModel: ''
  }
};

/**
 * 构建翻译提示词
 * @param {string} text - 要翻译的文本
 * @param {string} context - 上下文
 * @param {string} targetLang - 目标语言
 * @returns {string} 提示词
 */
export function buildTranslationPrompt(text, context, targetLang = 'zh-CN') {
  const langNames = {
    'zh-CN': '简体中文',
    'zh-TW': '繁体中文',
    'en': '英语',
    'ja': '日语',
    'ko': '韩语'
  };

  const targetLangName = langNames[targetLang] || '简体中文';

  return `你是一个专业的翻译助手。请将以下单词或短语翻译成${targetLangName}，并结合上下文分析其深层含义。

要翻译的内容：${text}

上下文：${context || '无'}

请按以下 JSON 格式返回：
{
  "translation": "基本翻译",
  "meaning": "结合上下文的深层含义分析（如果上下文不足以分析深层含义，可以留空）",
  "examples": ["例句1", "例句2"]
}

只返回 JSON，不要有其他内容。`;
}

/**
 * 调用 OpenAI 兼容 API
 * @param {string} baseUrl - API 基础地址
 * @param {string} apiKey - API 密钥
 * @param {string} model - 模型名称
 * @param {string} prompt - 提示词
 * @returns {Promise<Object>} 响应结果
 */
export async function callOpenAICompatible(baseUrl, apiKey, model, prompt) {
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

  return parseAIResponse(content);
}

/**
 * 调用 Claude API
 * @param {string} baseUrl - API 基础地址
 * @param {string} apiKey - API 密钥
 * @param {string} model - 模型名称
 * @param {string} prompt - 提示词
 * @returns {Promise<Object>} 响应结果
 */
export async function callClaudeAPI(baseUrl, apiKey, model, prompt) {
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API 请求失败: ${error}`);
  }

  const data = await response.json();
  const content = data.content[0].text;

  return parseAIResponse(content);
}

/**
 * 解析 AI 响应
 * @param {string} content - AI 返回的内容
 * @returns {Object} 解析后的对象
 */
function parseAIResponse(content) {
  try {
    // 尝试提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(content);
  } catch {
    // 如果解析失败，返回原始内容作为翻译
    return {
      translation: content.trim(),
      meaning: '',
      examples: []
    };
  }
}
