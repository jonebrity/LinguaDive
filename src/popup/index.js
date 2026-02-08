/**
 * LinguaDive - Popup Script
 * 弹出页面逻辑
 */

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadStats();
  await checkApiStatus();
  bindEvents();
}

/**
 * 加载统计数据
 */
async function loadStats() {
  try {
    const data = await chrome.storage.local.get(['knowledgeBase']);
    const knowledgeBase = data.knowledgeBase || [];

    // 总单词数
    document.getElementById('wordCount').textContent = knowledgeBase.length;

    // 今日新增
    const today = new Date().toDateString();
    const todayCount = knowledgeBase.filter(item => {
      return new Date(item.timestamp).toDateString() === today;
    }).length;
    document.getElementById('todayCount').textContent = todayCount;
  } catch (error) {
    console.error('加载统计数据失败:', error);
  }
}

/**
 * 检查 API 配置状态
 */
async function checkApiStatus() {
  const statusEl = document.getElementById('apiStatus');
  const dotEl = statusEl.querySelector('.status-dot');
  const textEl = statusEl.querySelector('.status-text');

  try {
    const data = await chrome.storage.sync.get(['aiSettings']);
    const settings = data.aiSettings || {};

    if (settings.apiKey) {
      dotEl.classList.add('active');
      textEl.textContent = `已配置 ${getProviderName(settings.provider)}`;
    } else {
      dotEl.classList.add('warning');
      textEl.textContent = '未配置 API，请前往设置';
    }
  } catch (error) {
    dotEl.classList.add('error');
    textEl.textContent = '检查配置失败';
  }
}

/**
 * 获取提供商名称
 */
function getProviderName(provider) {
  const names = {
    'openai': 'OpenAI',
    'claude': 'Claude',
    'deepseek': 'DeepSeek',
    'custom': '自定义 API'
  };
  return names[provider] || '未知';
}

/**
 * 绑定事件
 */
function bindEvents() {
  // 打开知识库
  document.getElementById('openKnowledge').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('src/knowledge/index.html') });
  });

  // 打开设置
  document.getElementById('openOptions').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}
