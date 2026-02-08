/**
 * LinguaDive - Content Script
 * 注入到网页中，处理选词和显示浮动工具条及结果弹窗
 */

// 浮动按钮条元素
let actionBarElement = null;
// 结果弹窗元素
let tooltipElement = null;
// 当前使用的 API 配置索引
let currentApiIndex = 0;
// API 配置列表
let apiConfigs = [];
// 当前选中的文本和上下文
let currentSelection = {
  text: '',
  context: '',
  rect: null
};
// 插件是否启用
let pluginEnabled = true;
// 快捷键配置
let shortcutKey = 'Shift+L';

// 初始化
init();

async function init() {
  // 加载 API 配置
  await loadApiConfigs();

  // 加载插件状态
  await loadPluginState();

  // 监听鼠标抬起事件（选词完成）
  document.addEventListener('mouseup', handleMouseUp);

  // 监听来自 background 的消息
  chrome.runtime.onMessage.addListener(handleMessage);

  // 点击其他地方关闭弹窗
  document.addEventListener('mousedown', handleMouseDown);

  // 监听快捷键
  document.addEventListener('keydown', handleShortcutKey);

  // 监听存储变化，实时更新配置
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.apiConfigs) {
      apiConfigs = changes.apiConfigs.newValue || [];
      if (currentApiIndex >= apiConfigs.length) {
        currentApiIndex = 0;
      }
    }
    if (changes.currentApiIndex) {
      currentApiIndex = changes.currentApiIndex.newValue || 0;
    }
    if (changes.pluginEnabled !== undefined) {
      pluginEnabled = changes.pluginEnabled.newValue !== false;
    }
    if (changes.shortcutKey) {
      shortcutKey = changes.shortcutKey.newValue || 'Shift+L';
    }
  });
}

/**
 * 加载插件状态
 */
async function loadPluginState() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getPluginState' });
    if (response.success) {
      pluginEnabled = response.data.enabled;
      shortcutKey = response.data.shortcutKey;
    }
  } catch (error) {
    console.error('加载插件状态失败:', error);
  }
}

/**
 * 处理快捷键
 */
function handleShortcutKey(e) {
  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Meta');

  let key = e.key;
  if (key === ' ') key = 'Space';
  else if (key.length === 1) key = key.toUpperCase();

  // 忽略单独的修饰键
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
    return;
  }

  parts.push(key);
  const pressedKey = parts.join('+');

  if (pressedKey === shortcutKey) {
    e.preventDefault();
    togglePlugin();
  }
}

/**
 * 切换插件启用状态
 */
async function togglePlugin() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'togglePlugin' });
    if (response.success) {
      pluginEnabled = response.enabled;
      showToggleNotification(pluginEnabled);

      // 如果禁用，关闭当前显示的工具条和弹窗
      if (!pluginEnabled) {
        hideActionBar();
        hideTooltip();
      }
    }
  } catch (error) {
    console.error('切换插件状态失败:', error);
  }
}

/**
 * 显示切换通知
 */
function showToggleNotification(enabled) {
  // 移除已有的通知
  const existing = document.querySelector('.linguadive-toggle-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.className = 'linguadive-toggle-notification';
  notification.innerHTML = `
    <span class="notification-icon">${enabled ? '✓' : '✗'}</span>
    <span>LinguaDive ${enabled ? '已启用' : '已停用'}</span>
  `;
  document.body.appendChild(notification);

  // 2秒后自动消失
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

/**
 * 加载 API 配置
 */
async function loadApiConfigs() {
  try {
    const data = await chrome.storage.sync.get(['apiConfigs', 'currentApiIndex']);
    apiConfigs = data.apiConfigs || [];
    currentApiIndex = data.currentApiIndex || 0;
  } catch (e) {
    console.error('加载 API 配置失败:', e);
  }
}

/**
 * 处理鼠标抬起事件
 */
function handleMouseUp(event) {
  // 如果插件被禁用，不处理
  if (!pluginEnabled) {
    return;
  }

  // 如果点击的是浮动按钮条或弹窗内部，不处理
  if (actionBarElement && actionBarElement.contains(event.target)) {
    return;
  }
  if (tooltipElement && tooltipElement.contains(event.target)) {
    return;
  }

  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (selectedText && selectedText.length > 0 && selectedText.length < 100000) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // 获取上下文
    const context = getContext(selection);

    // 保存当前选中信息
    currentSelection = {
      text: selectedText,
      context: context,
      rect: rect
    };

    // 显示浮动按钮条
    showActionBar(rect);
  }
}

/**
 * 处理鼠标按下事件
 */
function handleMouseDown(event) {
  // 点击浮动按钮条或弹窗外部时关闭
  if (actionBarElement && !actionBarElement.contains(event.target)) {
    if (!tooltipElement || !tooltipElement.contains(event.target)) {
      hideActionBar();
    }
  }
  if (tooltipElement && !tooltipElement.contains(event.target)) {
    if (!actionBarElement || !actionBarElement.contains(event.target)) {
      hideTooltip();
    }
  }
}

/**
 * 处理来自 background 的消息
 */
function handleMessage(request, sender, sendResponse) {
  if (request.action === 'translate') {
    if (!pluginEnabled) return;
    const selection = window.getSelection();
    if (selection.toString().trim() === request.text) {
      const context = getContext(selection);
      requestTranslation(request.text, context);
    }
  }

  if (request.action === 'pluginStateChanged') {
    pluginEnabled = request.enabled;
    if (!pluginEnabled) {
      hideActionBar();
      hideTooltip();
    }
  }
}

/**
 * 获取选中文本的上下文
 * @param {Selection} selection - 选中对象
 * @returns {string} 上下文文本
 */
function getContext(selection) {
  try {
    const selectedText = selection.toString().trim();
    const selectedLength = selectedText.length;

    // 根据选中文本长度决定上下文策略
    // 选中超过200字时，不获取额外上下文
    if (selectedLength > 200) {
      return '';
    }

    const range = selection.getRangeAt(0);
    let container = range.commonAncestorContainer;

    // 如果是文本节点，获取父元素
    if (container.nodeType === Node.TEXT_NODE) {
      container = container.parentElement;
    }

    // 向上查找段落或块级元素，但避免找到过大的容器
    let bestContainer = container;
    while (container && !isBlockElement(container)) {
      container = container.parentElement;
    }

    if (container) {
      const containerText = container.textContent || '';
      // 如果容器内容超过1000字，说明找到了过大的容器
      // 改用选中文本前后截取的方式
      if (containerText.length > 1000) {
        return getContextByPosition(container, selectedText, selectedLength);
      }
      bestContainer = container;
    }

    if (bestContainer) {
      const text = bestContainer.textContent || '';

      // 根据选中长度决定上下文范围
      let contextBefore, contextAfter;
      if (selectedLength < 50) {
        contextBefore = 150;
        contextAfter = 150;
      } else {
        contextBefore = 50;
        contextAfter = 50;
      }

      // 限制上下文最大长度为500字
      if (text.length > 500) {
        const index = text.indexOf(selectedText);
        if (index !== -1) {
          const start = Math.max(0, index - contextBefore);
          const end = Math.min(text.length, index + selectedLength + contextAfter);
          return text.substring(start, end);
        }
      }

      // 如果文本长度合理，直接返回
      if (text.length <= 500) {
        return text;
      }
    }
  } catch (e) {
    console.error('获取上下文失败:', e);
  }
  return '';
}

/**
 * 通过位置获取上下文（用于容器过大的情况）
 */
function getContextByPosition(container, selectedText, selectedLength) {
  const fullText = container.textContent || '';
  const index = fullText.indexOf(selectedText);

  if (index === -1) {
    return '';
  }

  // 根据选中长度决定上下文范围
  let contextBefore, contextAfter;
  if (selectedLength < 50) {
    contextBefore = 150;
    contextAfter = 150;
  } else {
    contextBefore = 50;
    contextAfter = 50;
  }

  const start = Math.max(0, index - contextBefore);
  const end = Math.min(fullText.length, index + selectedLength + contextAfter);

  return fullText.substring(start, end);
}

/**
 * 判断是否为块级元素
 */
function isBlockElement(element) {
  const blockTags = ['P', 'DIV', 'ARTICLE', 'SECTION', 'LI', 'TD', 'TH', 'BLOCKQUOTE', 'PRE'];
  return blockTags.includes(element.tagName);
}

/**
 * 显示浮动按钮条
 */
function showActionBar(rect) {
  hideActionBar();

  actionBarElement = document.createElement('div');
  actionBarElement.className = 'linguadive-action-bar';

  actionBarElement.innerHTML = `
    <button class="linguadive-action-btn" data-action="translate" title="翻译">译</button>
    <button class="linguadive-action-btn" data-action="explain" title="解释">释</button>
    <button class="linguadive-action-btn" data-action="summarize" title="总结">炼</button>
    <button class="linguadive-action-btn" data-action="collect" title="收藏">藏</button>
    <button class="linguadive-action-btn" data-action="knowledge" title="知识库">库</button>
  `;

  document.body.appendChild(actionBarElement);

  // 定位按钮条
  positionActionBar(rect);

  // 绑定按钮事件
  bindActionBarEvents();
}

/**
 * 定位浮动按钮条
 */
function positionActionBar(rect) {
  if (!actionBarElement) return;

  const barRect = actionBarElement.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = rect.left + window.scrollX + (rect.width - barRect.width) / 2;
  let top = rect.bottom + window.scrollY + 6;

  // 防止超出右边界
  if (left + barRect.width > viewportWidth + window.scrollX) {
    left = viewportWidth + window.scrollX - barRect.width - 10;
  }

  // 防止超出下边界，改为显示在上方
  if (top + barRect.height > viewportHeight + window.scrollY) {
    top = rect.top + window.scrollY - barRect.height - 6;
  }

  // 防止超出左边界
  if (left < window.scrollX) {
    left = window.scrollX + 10;
  }

  actionBarElement.style.left = `${left}px`;
  actionBarElement.style.top = `${top}px`;
}

/**
 * 绑定浮动按钮条事件
 */
function bindActionBarEvents() {
  if (!actionBarElement) return;

  const buttons = actionBarElement.querySelectorAll('.linguadive-action-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', handleActionClick);
  });
}

/**
 * 处理按钮点击
 */
async function handleActionClick(event) {
  const action = event.target.dataset.action;
  const { text, context, rect } = currentSelection;

  if (!text) return;

  switch (action) {
    case 'translate':
      hideActionBar();
      showTooltip(rect, text, null, true, 'translate');
      requestTranslation(text, context);
      break;
    case 'explain':
      hideActionBar();
      showTooltip(rect, text, null, true, 'explain');
      requestExplanation(text, context);
      break;
    case 'summarize':
      hideActionBar();
      showTooltip(rect, text, null, true, 'summarize');
      requestSummary(text, context);
      break;
    case 'collect':
      hideActionBar();
      await saveCollection(text);
      showCollectionSuccess();
      break;
    case 'knowledge':
      chrome.runtime.sendMessage({ action: 'openKnowledge' });
      break;
  }
}

/**
 * 隐藏浮动按钮条
 */
function hideActionBar() {
  if (actionBarElement) {
    actionBarElement.remove();
    actionBarElement = null;
  }
}

/**
 * 请求翻译
 */
async function requestTranslation(text, context) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'callAI',
      data: { text, context, apiIndex: currentApiIndex, type: 'translate' }
    });

    if (response.success) {
      updateTooltipContent(text, response.data, 'translate');
      // 保存到知识库
      saveToKnowledge(text, response.data, context, 'translation');
    } else {
      updateTooltipError(response.error);
    }
  } catch (error) {
    updateTooltipError(error.message);
  }
}

/**
 * 请求解释
 */
async function requestExplanation(text, context) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'callAI',
      data: { text, context, apiIndex: currentApiIndex, type: 'explain' }
    });

    if (response.success) {
      updateTooltipContent(text, response.data, 'explain');
      // 保存到知识库
      saveToKnowledge(text, response.data, context, 'explanation');
    } else {
      updateTooltipError(response.error);
    }
  } catch (error) {
    updateTooltipError(error.message);
  }
}

/**
 * 请求总结
 */
async function requestSummary(text, context) {
  // 如果内容少于30字，使用上下文进行总结
  let contentToSummarize = text.length < 30 ? context : text;

  // 总结功能字数上限为5万汉字，超出则裁剪
  const MAX_SUMMARIZE_LENGTH = 50000;
  if (contentToSummarize.length > MAX_SUMMARIZE_LENGTH) {
    contentToSummarize = contentToSummarize.substring(0, MAX_SUMMARIZE_LENGTH);
  }

  // 保存原文用于知识库（限制长度）
  const originalText = text.length > 10000 ? text.substring(0, 10000) + '...(已截断)' : text;
  // 只有少于30字时才保存上下文，且上下文不超过500字
  const contextToSave = text.length < 30 ? (context.length > 500 ? context.substring(0, 500) : context) : '';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'callAI',
      data: { text: contentToSummarize, context: '', apiIndex: currentApiIndex, type: 'summarize' }
    });

    if (response.success) {
      updateTooltipContent(text, response.data, 'summarize');
      // 保存到知识库，包含原文
      saveToKnowledgeSummary(originalText, response.data, contextToSave);
    } else {
      updateTooltipError(response.error);
    }
  } catch (error) {
    updateTooltipError(error.message);
  }
}

/**
 * 保存总结到知识库（特殊处理）
 */
async function saveToKnowledgeSummary(originalText, result, context) {
  const record = {
    id: Date.now().toString(),
    type: 'summary',
    word: originalText,
    result: JSON.stringify(result),
    context: context,
    url: window.location.href,
    title: document.title,
    timestamp: new Date().toISOString()
  };

  try {
    const data = await chrome.storage.local.get(['knowledgeBase']);
    const knowledgeBase = data.knowledgeBase || [];
    knowledgeBase.unshift(record);

    if (knowledgeBase.length > 10000) {
      knowledgeBase.pop();
    }

    await chrome.storage.local.set({ knowledgeBase });
  } catch (error) {
    console.error('保存到知识库失败:', error);
  }
}

/**
 * 保存收藏
 */
async function saveCollection(text) {
  // 合并连续的换行符（包括换行符之间有空格的情况）
  const cleanedText = text.replace(/(\s*\n\s*)+/g, '\n').trim();

  const record = {
    id: Date.now().toString(),
    type: 'collection',
    word: cleanedText,
    result: cleanedText,
    context: '',
    url: window.location.href,
    title: document.title,
    timestamp: new Date().toISOString()
  };

  try {
    const data = await chrome.storage.local.get(['knowledgeBase']);
    const knowledgeBase = data.knowledgeBase || [];
    knowledgeBase.unshift(record);

    // 限制存储数量，最多保存 10000 条
    if (knowledgeBase.length > 10000) {
      knowledgeBase.pop();
    }

    await chrome.storage.local.set({ knowledgeBase });
  } catch (error) {
    console.error('保存收藏失败:', error);
  }
}

/**
 * 显示收藏成功提示
 */
function showCollectionSuccess() {
  const toast = document.createElement('div');
  toast.className = 'linguadive-toast';
  toast.textContent = '已收藏到知识库';
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('linguadive-toast-hide');
    setTimeout(() => toast.remove(), 300);
  }, 1500);
}

/**
 * 显示结果弹窗
 */
function showTooltip(rect, word, result, loading = false, actionType = 'translate') {
  hideTooltip();

  tooltipElement = document.createElement('div');
  tooltipElement.className = 'linguadive-tooltip';
  tooltipElement.dataset.actionType = actionType;

  // 根据类型显示不同的加载文字
  const loadingTexts = {
    translate: '翻译中',
    explain: '解释中',
    summarize: '总结中'
  };
  const loadingText = loadingTexts[actionType] || '处理中';

  // 根据类型显示不同的标题
  const titleTexts = {
    translate: '翻译',
    explain: '解释',
    summarize: '总结'
  };
  const titleText = titleTexts[actionType] || '结果';

  if (loading) {
    tooltipElement.innerHTML = `
      <div class="linguadive-header">
        <span class="linguadive-title-badge">${titleText}</span>
        <span class="linguadive-word">${escapeHtml(word.length > 50 ? word.substring(0, 50) + '...' : word)}</span>
        <div class="linguadive-header-actions">
          <button class="linguadive-btn linguadive-settings" title="设置">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
          <button class="linguadive-btn linguadive-close" title="关闭">&times;</button>
        </div>
      </div>
      <div class="linguadive-content">
        <div class="linguadive-loading">${loadingText}...</div>
      </div>
    `;
  }

  document.body.appendChild(tooltipElement);

  // 定位弹窗
  positionTooltip(rect);

  // 绑定事件
  bindTooltipEvents();
}

/**
 * 绑定弹窗事件
 */
function bindTooltipEvents() {
  if (!tooltipElement) return;

  // 关闭按钮
  const closeBtn = tooltipElement.querySelector('.linguadive-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', hideTooltip);
  }

  // 设置按钮
  const settingsBtn = tooltipElement.querySelector('.linguadive-settings');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openOptions' });
    });
  }
}

/**
 * 更新弹窗内容
 */
function updateTooltipContent(word, result, actionType = 'translate') {
  if (!tooltipElement) return;

  const content = tooltipElement.querySelector('.linguadive-content');
  if (!content) return;

  if (actionType === 'translate') {
    let examplesHtml = '';
    if (result.examples && result.examples.length > 0) {
      examplesHtml = `
        <div class="linguadive-examples">
          <div class="linguadive-label">例句：</div>
          <ul>
            ${result.examples.map(ex => `<li>${escapeHtml(ex)}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    content.innerHTML = `
      <div class="linguadive-translation">
        <div class="linguadive-label">翻译：</div>
        <div class="linguadive-value">${escapeHtml(result.translation)}</div>
      </div>
      ${result.meaning ? `
        <div class="linguadive-meaning">
          <div class="linguadive-label">深层含义：</div>
          <div class="linguadive-value">${escapeHtml(result.meaning)}</div>
        </div>
      ` : ''}
      ${examplesHtml}
    `;
  } else if (actionType === 'explain') {
    content.innerHTML = `
      <div class="linguadive-explanation">
        <div class="linguadive-label">解释：</div>
        <div class="linguadive-value">${escapeHtml(result.explanation)}</div>
      </div>
      ${result.background ? `
        <div class="linguadive-background">
          <div class="linguadive-label">背景知识：</div>
          <div class="linguadive-value">${escapeHtml(result.background)}</div>
        </div>
      ` : ''}
    `;
  } else if (actionType === 'summarize') {
    content.innerHTML = `
      <div class="linguadive-summary">
        <div class="linguadive-label">核心要点：</div>
        <div class="linguadive-value">${escapeHtml(result.summary)}</div>
      </div>
      ${result.keyPoints && result.keyPoints.length > 0 ? `
        <div class="linguadive-keypoints">
          <div class="linguadive-label">关键点：</div>
          <ul>
            ${result.keyPoints.map(point => `<li>${escapeHtml(point)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    `;
  }
}

/**
 * 显示错误信息
 */
function updateTooltipError(error) {
  if (!tooltipElement) return;

  const content = tooltipElement.querySelector('.linguadive-content');
  if (content) {
    content.innerHTML = `
      <div class="linguadive-error">
        <span>翻译失败：${escapeHtml(error)}</span>
      </div>
    `;
  }
}

/**
 * 定位弹窗
 */
function positionTooltip(rect) {
  if (!tooltipElement) return;

  const tooltipRect = tooltipElement.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = rect.left + window.scrollX;
  let top = rect.bottom + window.scrollY + 8;

  // 防止超出右边界
  if (left + tooltipRect.width > viewportWidth + window.scrollX) {
    left = viewportWidth + window.scrollX - tooltipRect.width - 10;
  }

  // 防止超出下边界，改为显示在上方
  if (top + tooltipRect.height > viewportHeight + window.scrollY) {
    top = rect.top + window.scrollY - tooltipRect.height - 8;
  }

  // 防止超出左边界
  if (left < window.scrollX) {
    left = window.scrollX + 10;
  }

  tooltipElement.style.left = `${left}px`;
  tooltipElement.style.top = `${top}px`;
}

/**
 * 隐藏弹窗
 */
function hideTooltip() {
  if (tooltipElement) {
    tooltipElement.remove();
    tooltipElement = null;
  }
}

/**
 * 保存到知识库
 */
async function saveToKnowledge(word, result, context, type = 'translation') {
  const record = {
    id: Date.now().toString(),
    type: type,
    word: word,
    result: JSON.stringify(result),
    context: context,
    url: window.location.href,
    title: document.title,
    timestamp: new Date().toISOString()
  };

  try {
    const data = await chrome.storage.local.get(['knowledgeBase']);
    const knowledgeBase = data.knowledgeBase || [];
    knowledgeBase.unshift(record);

    // 限制存储数量，最多保存 10000 条
    if (knowledgeBase.length > 10000) {
      knowledgeBase.pop();
    }

    await chrome.storage.local.set({ knowledgeBase });
  } catch (error) {
    console.error('保存到知识库失败:', error);
  }
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
