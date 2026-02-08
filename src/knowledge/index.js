/**
 * LinguaDive - Knowledge Script
 * 知识库管理页面逻辑
 */

const PAGE_SIZE = 20;
let currentPage = 1;
let knowledgeBase = [];
let filteredData = [];
let currentDetailId = null;
let currentType = 'all'; // 当前选中的类型
let selectedIds = new Set(); // 选中的记录 ID

// 类型显示名称
const TYPE_NAMES = {
  translation: '翻译',
  explanation: '解释',
  summary: '总结',
  collection: '收藏'
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadData();
  bindEvents();
}

/**
 * 加载数据
 */
async function loadData() {
  try {
    const data = await chrome.storage.local.get(['knowledgeBase']);
    knowledgeBase = (data.knowledgeBase || []).map(item => {
      // 兼容旧数据：没有 type 字段的记录默认为 translation
      if (!item.type) {
        return { ...item, type: 'translation' };
      }
      return item;
    });
    filterByType(currentType);
    updateCounts();
    renderList();
  } catch (error) {
    console.error('加载数据失败:', error);
  }
}

/**
 * 绑定事件
 */
function bindEvents() {
  // 标签页切换
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentType = btn.dataset.type;
      currentPage = 1;
      // 切换标签页时清除选中状态
      selectedIds.clear();
      updateDeleteSelectedBtn();
      filterByType(currentType);
      renderList();
    });
  });

  // 搜索
  document.getElementById('searchInput').addEventListener('input', debounce(handleSearch, 300));

  // 导出
  document.getElementById('exportBtn').addEventListener('click', exportData);

  // 清空
  document.getElementById('clearBtn').addEventListener('click', clearCurrentType);

  // 设置按钮
  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openOptions' });
  });

  // 关闭弹窗
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('detailModal').addEventListener('click', (e) => {
    if (e.target.id === 'detailModal') closeModal();
  });

  // 删除记录
  document.getElementById('deleteBtn').addEventListener('click', deleteRecord);

  // 全选
  document.getElementById('selectAll').addEventListener('change', handleSelectAllChange);

  // 删除选中
  document.getElementById('deleteSelectedBtn').addEventListener('click', deleteSelectedRecords);
}

/**
 * 按类型筛选数据
 */
function filterByType(type) {
  if (type === 'all') {
    filteredData = [...knowledgeBase];
  } else {
    filteredData = knowledgeBase.filter(item => item.type === type);
  }
}

/**
 * 更新各类型数量
 */
function updateCounts() {
  const counts = {
    all: knowledgeBase.length,
    translation: 0,
    explanation: 0,
    summary: 0,
    collection: 0
  };

  knowledgeBase.forEach(item => {
    const type = item.type || 'translation';
    if (counts[type] !== undefined) {
      counts[type]++;
    }
  });

  document.getElementById('totalCount').textContent = counts.all;
  document.getElementById('countAll').textContent = counts.all;
  document.getElementById('countTranslation').textContent = counts.translation;
  document.getElementById('countExplanation').textContent = counts.explanation;
  document.getElementById('countSummary').textContent = counts.summary;
  document.getElementById('countCollection').textContent = counts.collection;
}

/**
 * 渲染列表
 */
function renderList() {
  const listEl = document.getElementById('wordList');
  const emptyEl = document.getElementById('emptyState');

  // 应用搜索过滤
  const keyword = document.getElementById('searchInput').value.trim().toLowerCase();
  let displayData = filteredData;
  if (keyword) {
    displayData = filteredData.filter(item => {
      const word = (item.word || '').toLowerCase();
      const result = getResultText(item).toLowerCase();
      return word.includes(keyword) || result.includes(keyword);
    });
  }

  if (displayData.length === 0) {
    listEl.style.display = 'none';
    emptyEl.style.display = 'block';
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  listEl.style.display = 'flex';
  emptyEl.style.display = 'none';

  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageData = displayData.slice(start, end);

  listEl.innerHTML = pageData.map(item => `
    <div class="word-item" data-id="${item.id}">
      <label class="word-checkbox" onclick="event.stopPropagation()">
        <input type="checkbox" class="item-checkbox" data-id="${item.id}" ${selectedIds.has(item.id) ? 'checked' : ''}>
      </label>
      <div class="word-content">
        <div class="word-main">
          <span class="word-type-badge word-type-${item.type || 'translation'}">${TYPE_NAMES[item.type] || '翻译'}</span>
          <span class="word-text">${escapeHtml(truncate(item.word, 50))}</span>
          <span class="word-result">${escapeHtml(truncate(getResultPreview(item), 60))}</span>
        </div>
        <div class="word-meta">
          <span class="word-date">${formatDate(item.timestamp)}</span>
          <span class="word-source" title="${escapeHtml(item.title)}">${truncate(item.title, 30)}</span>
        </div>
      </div>
    </div>
  `).join('');

  // 绑定点击事件
  listEl.querySelectorAll('.word-item').forEach(el => {
    el.addEventListener('click', (e) => {
      // 如果点击的是复选框区域，不打开详情
      if (e.target.closest('.word-checkbox')) return;
      showDetail(el.dataset.id);
    });
  });

  // 绑定复选框事件
  listEl.querySelectorAll('.item-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', handleItemCheckboxChange);
  });

  // 更新全选状态
  updateSelectAllState();

  renderPagination(displayData.length);
}

/**
 * 获取结果预览文本
 */
function getResultPreview(item) {
  if (item.type === 'collection') {
    return item.word;
  }
  const result = parseResult(item);
  if (item.type === 'translation') {
    return result.translation || '';
  } else if (item.type === 'explanation') {
    return result.explanation || '';
  } else if (item.type === 'summary') {
    return result.summary || '';
  }
  return result.translation || '';
}

/**
 * 获取结果文本用于搜索
 */
function getResultText(item) {
  const result = parseResult(item);
  return JSON.stringify(result);
}

/**
 * 解析结果字段
 */
function parseResult(item) {
  if (!item.result) {
    // 兼容旧数据格式
    return {
      translation: item.translation || '',
      meaning: item.meaning || '',
      examples: item.examples || []
    };
  }
  try {
    return typeof item.result === 'string' ? JSON.parse(item.result) : item.result;
  } catch {
    return { translation: item.result };
  }
}

/**
 * 渲染分页
 */
function renderPagination(totalCount) {
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const paginationEl = document.getElementById('pagination');

  if (totalPages <= 1) {
    paginationEl.innerHTML = '';
    return;
  }

  let html = '';

  // 上一页
  html += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">上一页</button>`;

  // 页码
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += '<span class="page-ellipsis">...</span>';
    }
  }

  // 下一页
  html += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">下一页</button>`;

  paginationEl.innerHTML = html;

  // 绑定分页事件
  paginationEl.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!btn.disabled) {
        const newPage = parseInt(btn.dataset.page);
        if (newPage !== currentPage) {
          // 翻页时清除选中状态
          selectedIds.clear();
          updateDeleteSelectedBtn();
        }
        currentPage = newPage;
        renderList();
        window.scrollTo(0, 0);
      }
    });
  });
}

/**
 * 搜索处理
 */
function handleSearch() {
  currentPage = 1;
  // 搜索时清除选中状态
  selectedIds.clear();
  updateDeleteSelectedBtn();
  renderList();
}

/**
 * 显示详情
 */
function showDetail(id) {
  const item = knowledgeBase.find(i => i.id === id);
  if (!item) return;

  currentDetailId = id;

  const typeName = TYPE_NAMES[item.type] || '翻译';
  document.getElementById('modalTypeBadge').textContent = typeName;
  document.getElementById('modalTypeBadge').className = `modal-type-badge modal-type-${item.type || 'translation'}`;
  document.getElementById('modalWord').textContent = truncate(item.word, 100);

  const result = parseResult(item);
  let contentHtml = '';

  if (item.type === 'collection') {
    // 收藏类型：显示原文
    contentHtml = `
      <div class="detail-section">
        <h3>收藏内容</h3>
        <p class="collection-text">${escapeHtml(item.word)}</p>
      </div>
    `;
  } else if (item.type === 'translation') {
    // 翻译类型
    let examplesHtml = '';
    if (result.examples && result.examples.length > 0) {
      examplesHtml = `
        <div class="detail-section">
          <h3>例句</h3>
          <ul class="examples-list">
            ${result.examples.map(ex => `<li>${escapeHtml(ex)}</li>`).join('')}
          </ul>
        </div>
      `;
    }
    contentHtml = `
      <div class="detail-section">
        <h3>翻译</h3>
        <p>${escapeHtml(result.translation || '')}</p>
      </div>
      ${result.meaning ? `
        <div class="detail-section">
          <h3>深层含义</h3>
          <p>${escapeHtml(result.meaning)}</p>
        </div>
      ` : ''}
      ${examplesHtml}
    `;
  } else if (item.type === 'explanation') {
    // 解释类型
    contentHtml = `
      <div class="detail-section">
        <h3>解释</h3>
        <p>${escapeHtml(result.explanation || '')}</p>
      </div>
      ${result.background ? `
        <div class="detail-section">
          <h3>背景知识</h3>
          <p>${escapeHtml(result.background)}</p>
        </div>
      ` : ''}
    `;
  } else if (item.type === 'summary') {
    // 总结类型
    let keyPointsHtml = '';
    if (result.keyPoints && result.keyPoints.length > 0) {
      keyPointsHtml = `
        <div class="detail-section">
          <h3>关键点</h3>
          <ul class="examples-list">
            ${result.keyPoints.map(point => `<li>${escapeHtml(point)}</li>`).join('')}
          </ul>
        </div>
      `;
    }
    contentHtml = `
      <div class="detail-section">
        <h3>核心要点</h3>
        <p>${escapeHtml(result.summary || '')}</p>
      </div>
      ${keyPointsHtml}
    `;
  }

  // 添加上下文（收藏类型不显示上下文）
  if (item.type !== 'collection' && item.context) {
    contentHtml += `
      <div class="detail-section">
        <h3>上下文</h3>
        <p class="context-text">${escapeHtml(item.context)}</p>
      </div>
    `;
  }

  // 添加原文（收藏类型不显示，因为已在"收藏内容"中显示）
  if (item.type !== 'collection' && item.word) {
    contentHtml += `
      <div class="detail-section">
        <h3>原文</h3>
        <p class="original-text">${escapeHtml(item.word)}</p>
      </div>
    `;
  }

  // 添加来源
  contentHtml += `
    <div class="detail-section">
      <h3>来源</h3>
      <p><a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(item.title)}</a></p>
      <p class="meta-text">${formatDate(item.timestamp)}</p>
    </div>
  `;

  document.getElementById('modalBody').innerHTML = contentHtml;
  document.getElementById('detailModal').classList.add('show');
}

/**
 * 关闭弹窗
 */
function closeModal() {
  document.getElementById('detailModal').classList.remove('show');
  currentDetailId = null;
}

/**
 * 删除记录
 */
async function deleteRecord() {
  if (!currentDetailId) return;

  if (!confirm('确定要删除这条记录吗？')) return;

  try {
    knowledgeBase = knowledgeBase.filter(i => i.id !== currentDetailId);
    await chrome.storage.local.set({ knowledgeBase });

    filterByType(currentType);
    updateCounts();
    renderList();
    closeModal();
  } catch (error) {
    alert('删除失败: ' + error.message);
  }
}

/**
 * 处理单个复选框变化
 */
function handleItemCheckboxChange(e) {
  const id = e.target.dataset.id;
  if (e.target.checked) {
    selectedIds.add(id);
  } else {
    selectedIds.delete(id);
  }
  updateSelectAllState();
  updateDeleteSelectedBtn();
}

/**
 * 处理全选复选框变化
 */
function handleSelectAllChange(e) {
  const checkboxes = document.querySelectorAll('.item-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = e.target.checked;
    const id = checkbox.dataset.id;
    if (e.target.checked) {
      selectedIds.add(id);
    } else {
      selectedIds.delete(id);
    }
  });
  updateDeleteSelectedBtn();
}

/**
 * 更新全选复选框状态
 */
function updateSelectAllState() {
  const checkboxes = document.querySelectorAll('.item-checkbox');
  const selectAllCheckbox = document.getElementById('selectAll');
  if (checkboxes.length === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
    return;
  }
  const checkedCount = document.querySelectorAll('.item-checkbox:checked').length;
  selectAllCheckbox.checked = checkedCount === checkboxes.length;
  selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
}

/**
 * 更新删除选中按钮显示状态
 */
function updateDeleteSelectedBtn() {
  const btn = document.getElementById('deleteSelectedBtn');
  if (selectedIds.size > 0) {
    btn.style.display = 'inline-block';
    btn.textContent = `删除选中 (${selectedIds.size})`;
  } else {
    btn.style.display = 'none';
  }
}

/**
 * 删除选中的记录
 */
async function deleteSelectedRecords() {
  if (selectedIds.size === 0) return;

  if (!confirm(`确定要删除选中的 ${selectedIds.size} 条记录吗？`)) return;

  try {
    knowledgeBase = knowledgeBase.filter(i => !selectedIds.has(i.id));
    await chrome.storage.local.set({ knowledgeBase });

    selectedIds.clear();
    filterByType(currentType);
    updateCounts();
    renderList();
    updateDeleteSelectedBtn();
  } catch (error) {
    alert('删除失败: ' + error.message);
  }
}

/**
 * 导出数据
 */
function exportData() {
  const dataToExport = currentType === 'all' ? knowledgeBase : filteredData;

  if (dataToExport.length === 0) {
    alert('暂无数据可导出');
    return;
  }

  const dataStr = JSON.stringify(dataToExport, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  const typeSuffix = currentType === 'all' ? 'all' : currentType;
  a.download = `linguadive-${typeSuffix}-${formatDateForFile(new Date())}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * 清空当前分类
 */
async function clearCurrentType() {
  const dataToDelete = currentType === 'all' ? knowledgeBase : filteredData;

  if (dataToDelete.length === 0) {
    alert('暂无数据');
    return;
  }

  const typeName = currentType === 'all' ? '全部' : TYPE_NAMES[currentType];
  if (!confirm(`确定要清空"${typeName}"分类下的 ${dataToDelete.length} 条记录吗？此操作不可恢复！`)) return;

  try {
    if (currentType === 'all') {
      knowledgeBase = [];
    } else {
      knowledgeBase = knowledgeBase.filter(item => item.type !== currentType);
    }
    await chrome.storage.local.set({ knowledgeBase });

    filterByType(currentType);
    updateCounts();
    renderList();
  } catch (error) {
    alert('清空失败: ' + error.message);
  }
}

// 工具函数
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDateForFile(date) {
  return date.toISOString().slice(0, 10);
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
