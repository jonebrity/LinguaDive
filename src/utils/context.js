/**
 * LinguaDive - Context Utils
 * 上下文提取工具函数
 */

/**
 * 从选中文本获取上下文
 * @param {Selection} selection - 选中对象
 * @param {number} maxLength - 最大上下文长度
 * @returns {string} 上下文文本
 */
export function getContextFromSelection(selection, maxLength = 500) {
  try {
    const range = selection.getRangeAt(0);
    let container = range.commonAncestorContainer;

    // 如果是文本节点，获取父元素
    if (container.nodeType === Node.TEXT_NODE) {
      container = container.parentElement;
    }

    // 向上查找段落或块级元素
    while (container && !isBlockElement(container)) {
      container = container.parentElement;
    }

    if (container) {
      const text = container.textContent || '';
      return truncateContext(text, selection.toString(), maxLength);
    }
  } catch (e) {
    console.error('获取上下文失败:', e);
  }
  return '';
}

/**
 * 判断是否为块级元素
 * @param {Element} element - DOM 元素
 * @returns {boolean} 是否为块级元素
 */
export function isBlockElement(element) {
  const blockTags = [
    'P', 'DIV', 'ARTICLE', 'SECTION', 'LI', 'TD', 'TH',
    'BLOCKQUOTE', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'HEADER', 'FOOTER', 'MAIN', 'NAV', 'ASIDE', 'FIGURE'
  ];
  return blockTags.includes(element.tagName);
}

/**
 * 截取上下文
 * @param {string} text - 完整文本
 * @param {string} selectedText - 选中的文本
 * @param {number} maxLength - 最大长度
 * @returns {string} 截取后的上下文
 */
export function truncateContext(text, selectedText, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }

  const index = text.indexOf(selectedText);
  if (index === -1) {
    return text.substring(0, maxLength);
  }

  // 计算前后各取多少字符
  const halfLength = Math.floor((maxLength - selectedText.length) / 2);
  const start = Math.max(0, index - halfLength);
  const end = Math.min(text.length, index + selectedText.length + halfLength);

  let result = text.substring(start, end);

  // 添加省略号
  if (start > 0) {
    result = '...' + result;
  }
  if (end < text.length) {
    result = result + '...';
  }

  return result;
}

/**
 * 清理文本（去除多余空白）
 * @param {string} text - 原始文本
 * @returns {string} 清理后的文本
 */
export function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 获取页面信息
 * @returns {Object} 页面信息
 */
export function getPageInfo() {
  return {
    url: window.location.href,
    title: document.title,
    domain: window.location.hostname
  };
}
