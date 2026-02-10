/**
 * LinguaDive - Options Script
 * 设置页面逻辑 - 支持多 API 配置
 */

let apiConfigs = [];
let currentEditIndex = -1; // -1 表示新增，>=0 表示编辑
let isRecordingShortcut = false;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadData();
  bindEvents();
  renderApiList();
}

/**
 * 加载数据
 */
async function loadData() {
  try {
    const data = await chrome.storage.sync.get(['apiConfigs', 'targetLang', 'pluginEnabled', 'shortcutKey']);
    apiConfigs = data.apiConfigs || [];

    if (data.targetLang) {
      document.getElementById('targetLang').value = data.targetLang;
    }

    // 加载基本设置
    document.getElementById('pluginEnabled').checked = data.pluginEnabled !== false;
    document.getElementById('shortcutKey').value = data.shortcutKey || 'Shift+L';
  } catch (error) {
    showMessage('加载设置失败: ' + error.message, 'error');
  }
}

/**
 * 绑定事件
 */
function bindEvents() {
  // 添加 API 按钮
  document.getElementById('addApiBtn').addEventListener('click', () => openApiModal(-1));

  // 导出/导入 API 配置
  document.getElementById('exportApiBtn').addEventListener('click', exportApiConfigs);
  document.getElementById('importApiBtn').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });
  document.getElementById('importFileInput').addEventListener('change', importApiConfigs);

  // 保存基本设置
  document.getElementById('saveBasicSettingsBtn').addEventListener('click', saveBasicSettings);

  // 快捷键录制
  document.getElementById('recordShortcut').addEventListener('click', startRecordShortcut);
  document.getElementById('resetShortcut').addEventListener('click', resetShortcut);
  document.getElementById('shortcutKey').addEventListener('keydown', handleShortcutKeydown);

  // 保存翻译设置
  document.getElementById('saveSettingsBtn').addEventListener('click', saveTranslationSettings);

  // 弹窗相关
  document.getElementById('modalClose').addEventListener('click', closeApiModal);
  document.getElementById('apiModal').addEventListener('click', (e) => {
    if (e.target.id === 'apiModal') closeApiModal();
  });

  // 提供商切换
  document.getElementById('provider').addEventListener('change', updateBaseUrlPlaceholder);

  // 显示/隐藏密码
  document.getElementById('togglePassword').addEventListener('click', togglePassword);

  // 保存 API
  document.getElementById('saveApiBtn').addEventListener('click', saveApi);

  // 测试 API
  document.getElementById('testApiBtn').addEventListener('click', testApi);
}

/**
 * 渲染 API 列表
 */
function renderApiList() {
  const listEl = document.getElementById('apiList');
  const emptyEl = document.getElementById('emptyState');

  if (apiConfigs.length === 0) {
    listEl.style.display = 'none';
    emptyEl.style.display = 'block';
    return;
  }

  listEl.style.display = 'block';
  emptyEl.style.display = 'none';

  listEl.innerHTML = apiConfigs.map((config, index) => {
    // 构建功能标签
    const features = [];
    if (config.useForTranslate !== false) features.push('译');
    if (config.useForExplain !== false) features.push('释');
    if (config.useForSummarize !== false) features.push('炼');
    const featuresHtml = features.length > 0
      ? `<span class="api-features">${features.join(' ')}</span>`
      : '';

    return `
      <div class="api-item" data-index="${index}">
        <div class="api-info">
          <div class="api-name">${escapeHtml(config.name || `API ${index + 1}`)}</div>
          <div class="api-detail">
            <span class="api-provider">${getProviderName(config.provider)}</span>
            ${config.model ? `<span class="api-model">${escapeHtml(config.model)}</span>` : ''}
            ${featuresHtml}
          </div>
        </div>
        <div class="api-actions">
          <button class="btn btn-small btn-secondary api-edit-btn" data-index="${index}">编辑</button>
          <button class="btn btn-small btn-danger api-delete-btn" data-index="${index}">删除</button>
        </div>
      </div>
    `;
  }).join('');

  // 绑定编辑和删除事件
  listEl.querySelectorAll('.api-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openApiModal(parseInt(btn.dataset.index)));
  });

  listEl.querySelectorAll('.api-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteApi(parseInt(btn.dataset.index)));
  });
}

/**
 * 打开 API 编辑弹窗
 */
function openApiModal(index) {
  currentEditIndex = index;
  const modal = document.getElementById('apiModal');
  const title = document.getElementById('modalTitle');

  // 清除之前的测试结果
  clearTestResult();

  if (index === -1) {
    // 新增
    title.textContent = '添加 API';
    document.getElementById('apiName').value = '';
    document.getElementById('provider').value = 'openai';
    document.getElementById('apiKey').value = '';
    document.getElementById('baseUrl').value = '';
    document.getElementById('model').value = '';
    document.getElementById('useForTranslate').checked = true;
    document.getElementById('useForExplain').checked = true;
    document.getElementById('useForSummarize').checked = true;
  } else {
    // 编辑
    title.textContent = '编辑 API';
    const config = apiConfigs[index];
    document.getElementById('apiName').value = config.name || '';
    document.getElementById('provider').value = config.provider || 'openai';
    document.getElementById('apiKey').value = config.apiKey || '';
    document.getElementById('baseUrl').value = config.baseUrl || '';
    document.getElementById('model').value = config.model || '';
    document.getElementById('useForTranslate').checked = config.useForTranslate !== false;
    document.getElementById('useForExplain').checked = config.useForExplain !== false;
    document.getElementById('useForSummarize').checked = config.useForSummarize !== false;
  }

  updateBaseUrlPlaceholder();
  modal.classList.add('show');
}

/**
 * 关闭 API 编辑弹窗
 */
function closeApiModal() {
  document.getElementById('apiModal').classList.remove('show');
  currentEditIndex = -1;
  clearTestResult();
}

/**
 * 更新 Base URL 占位符
 */
function updateBaseUrlPlaceholder() {
  const provider = document.getElementById('provider').value;
  const baseUrlInput = document.getElementById('baseUrl');

  const placeholders = {
    'openai': 'https://api.openai.com/v1',
    'claude': 'https://api.anthropic.com',
    'deepseek': 'https://api.deepseek.com/v1',
    'custom': '输入自定义 API 地址（必填）'
  };
  baseUrlInput.placeholder = placeholders[provider] || '';
}

/**
 * 切换密码显示
 */
function togglePassword() {
  const input = document.getElementById('apiKey');
  const btn = document.getElementById('togglePassword');

  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '隐藏';
  } else {
    input.type = 'password';
    btn.textContent = '显示';
  }
}

/**
 * 保存 API 配置
 */
async function saveApi() {
  const config = {
    name: document.getElementById('apiName').value.trim(),
    provider: document.getElementById('provider').value,
    apiKey: document.getElementById('apiKey').value.trim(),
    baseUrl: document.getElementById('baseUrl').value.trim(),
    model: document.getElementById('model').value.trim(),
    useForTranslate: document.getElementById('useForTranslate').checked,
    useForExplain: document.getElementById('useForExplain').checked,
    useForSummarize: document.getElementById('useForSummarize').checked
  };

  // 验证
  if (!config.apiKey) {
    showTestResult('请输入 API Key', 'error');
    return;
  }

  if (config.provider === 'custom' && !config.baseUrl) {
    showTestResult('自定义提供商需要填写 API Base URL', 'error');
    return;
  }

  // 至少选择一个功能
  if (!config.useForTranslate && !config.useForExplain && !config.useForSummarize) {
    showTestResult('请至少选择一个功能', 'error');
    return;
  }

  // 自动生成名称
  if (!config.name) {
    config.name = getProviderName(config.provider) + (config.model ? ` (${config.model})` : '');
  }

  try {
    // 功能互斥：取消其他 API 的相同功能勾选
    apiConfigs.forEach((existingConfig, index) => {
      // 跳过当前正在编辑的 API
      if (index === currentEditIndex) return;

      if (config.useForTranslate && existingConfig.useForTranslate !== false) {
        existingConfig.useForTranslate = false;
      }
      if (config.useForExplain && existingConfig.useForExplain !== false) {
        existingConfig.useForExplain = false;
      }
      if (config.useForSummarize && existingConfig.useForSummarize !== false) {
        existingConfig.useForSummarize = false;
      }
    });

    if (currentEditIndex === -1) {
      // 新增
      apiConfigs.push(config);
    } else {
      // 编辑
      apiConfigs[currentEditIndex] = config;
    }

    await chrome.storage.sync.set({ apiConfigs });
    showMessage('API 配置已保存', 'success');
    closeApiModal();
    renderApiList();
  } catch (error) {
    showTestResult('保存失败: ' + error.message, 'error');
  }
}

/**
 * 删除 API 配置
 */
async function deleteApi(index) {
  const config = apiConfigs[index];
  const name = config.name || `API ${index + 1}`;

  if (!confirm(`确定要删除「${name}」吗？`)) {
    return;
  }

  try {
    apiConfigs.splice(index, 1);
    await chrome.storage.sync.set({ apiConfigs });

    // 如果删除的是当前选中的 API，重置索引
    const data = await chrome.storage.sync.get(['currentApiIndex']);
    let currentIndex = data.currentApiIndex || 0;
    if (currentIndex >= apiConfigs.length) {
      currentIndex = Math.max(0, apiConfigs.length - 1);
      await chrome.storage.sync.set({ currentApiIndex: currentIndex });
    }

    showMessage('已删除', 'success');
    renderApiList();
  } catch (error) {
    showMessage('删除失败: ' + error.message, 'error');
  }
}

/**
 * 测试 API 连接
 */
async function testApi() {
  const btn = document.getElementById('testApiBtn');
  btn.disabled = true;
  btn.textContent = '测试中...';

  // 获取当前窗口中的配置参数
  const tempConfig = {
    name: 'test',
    provider: document.getElementById('provider').value,
    apiKey: document.getElementById('apiKey').value.trim(),
    baseUrl: document.getElementById('baseUrl').value.trim(),
    model: document.getElementById('model').value.trim()
  };

  if (!tempConfig.apiKey) {
    showTestResult('请先输入 API Key', 'error');
    btn.disabled = false;
    btn.textContent = '测试连接';
    return;
  }

  if (tempConfig.provider === 'custom' && !tempConfig.baseUrl) {
    showTestResult('自定义提供商需要填写 API Base URL', 'error');
    btn.disabled = false;
    btn.textContent = '测试连接';
    return;
  }

  showTestResult('正在测试连接...', 'loading');

  try {
    // 直接调用测试 API
    const response = await chrome.runtime.sendMessage({
      action: 'testAPI',
      data: tempConfig
    });

    if (response.success) {
      showTestResult('连接成功！API 工作正常', 'success');
    } else {
      showTestResult('连接失败: ' + response.error, 'error');
    }
  } catch (error) {
    showTestResult('测试失败: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '测试连接';
  }
}

/**
 * 显示测试结果（在弹窗内）
 */
function showTestResult(text, type) {
  const resultEl = document.getElementById('testResult');
  resultEl.textContent = text;
  resultEl.className = 'test-result ' + type;
}

/**
 * 清除测试结果
 */
function clearTestResult() {
  const resultEl = document.getElementById('testResult');
  resultEl.textContent = '';
  resultEl.className = 'test-result';
}

/**
 * 保存基本设置
 */
async function saveBasicSettings() {
  try {
    const pluginEnabled = document.getElementById('pluginEnabled').checked;
    const shortcutKey = document.getElementById('shortcutKey').value || 'Shift+L';

    await chrome.storage.sync.set({ pluginEnabled, shortcutKey });

    // 通知所有标签页更新状态
    chrome.runtime.sendMessage({ action: 'updatePluginState', enabled: pluginEnabled });

    showMessage('基本设置已保存', 'success');
  } catch (error) {
    showMessage('保存失败: ' + error.message, 'error');
  }
}

/**
 * 开始录制快捷键
 */
function startRecordShortcut() {
  isRecordingShortcut = true;
  const input = document.getElementById('shortcutKey');
  input.value = '请按下快捷键...';
  input.classList.add('recording');
  input.focus();
  document.getElementById('recordShortcut').textContent = '录制中';
}

/**
 * 停止录制快捷键
 */
function stopRecordShortcut() {
  isRecordingShortcut = false;
  const input = document.getElementById('shortcutKey');
  input.classList.remove('recording');
  document.getElementById('recordShortcut').textContent = '录制';
}

/**
 * 重置快捷键
 */
function resetShortcut() {
  document.getElementById('shortcutKey').value = 'Shift+L';
  stopRecordShortcut();
}

/**
 * 处理快捷键按下
 */
function handleShortcutKeydown(e) {
  if (!isRecordingShortcut) return;

  e.preventDefault();
  e.stopPropagation();

  // 忽略单独的修饰键
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
    return;
  }

  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Meta');

  // 获取按键名称
  let key = e.key;
  if (key === ' ') key = 'Space';
  else if (key.length === 1) key = key.toUpperCase();

  parts.push(key);

  document.getElementById('shortcutKey').value = parts.join('+');
  stopRecordShortcut();
}

/**
 * 导出 API 配置
 */
function exportApiConfigs() {
  if (apiConfigs.length === 0) {
    showMessage('没有可导出的 API 配置', 'error');
    return;
  }

  const exportData = {
    version: '1.0',
    type: 'linguadive-api-configs',
    configs: apiConfigs,
    exportTime: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `LinguaDive-API-Configs-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);

  showMessage(`已导出 ${apiConfigs.length} 个 API 配置`, 'success');
}

/**
 * 导入 API 配置
 */
async function importApiConfigs(e) {
  const file = e.target.files[0];
  if (!file) return;

  // 重置 input，允许重复选择同一文件
  e.target.value = '';

  try {
    const text = await file.text();
    const importData = JSON.parse(text);

    // 验证文件格式
    if (importData.type !== 'linguadive-api-configs' || !Array.isArray(importData.configs)) {
      showMessage('无效的配置文件格式', 'error');
      return;
    }

    if (importData.configs.length === 0) {
      showMessage('配置文件中没有 API 配置', 'error');
      return;
    }

    const count = importData.configs.length;
    const action = apiConfigs.length > 0
      ? confirm(`当前已有 ${apiConfigs.length} 个配置。\n\n点击"确定"覆盖现有配置，点击"取消"追加到现有配置后面。`)
      : true;

    if (action) {
      // 覆盖
      apiConfigs = importData.configs;
    } else {
      // 追加
      apiConfigs = apiConfigs.concat(importData.configs);
    }

    await chrome.storage.sync.set({ apiConfigs });
    renderApiList();
    showMessage(`已导入 ${count} 个 API 配置`, 'success');
  } catch (error) {
    showMessage('导入失败: ' + error.message, 'error');
  }
}

/**
 * 保存翻译设置
 */
async function saveTranslationSettings() {
  try {
    const targetLang = document.getElementById('targetLang').value;
    await chrome.storage.sync.set({ targetLang });
    showMessage('翻译设置已保存', 'success');
  } catch (error) {
    showMessage('保存失败: ' + error.message, 'error');
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
    'custom': '自定义'
  };
  return names[provider] || '未知';
}

/**
 * 显示消息
 */
function showMessage(text, type) {
  const messageEl = document.getElementById('message');
  messageEl.textContent = text;
  messageEl.className = 'message ' + type;

  setTimeout(() => {
    messageEl.className = 'message';
    messageEl.textContent = '';
  }, 5000);
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
