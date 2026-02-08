/**
 * LinguaDive - Storage Utils
 * 存储相关工具函数
 */

/**
 * 知识库记录类型
 */
export const RECORD_TYPES = {
  TRANSLATION: 'translation',
  EXPLANATION: 'explanation',
  SUMMARY: 'summary',
  COLLECTION: 'collection'
};

/**
 * 类型显示名称
 */
export const TYPE_NAMES = {
  translation: '翻译',
  explanation: '解释',
  summary: '总结',
  collection: '收藏'
};

/**
 * 获取知识库数据
 * @param {string} type - 可选，按类型筛选
 * @returns {Promise<Array>} 知识库数组
 */
export async function getKnowledgeBase(type = null) {
  const data = await chrome.storage.local.get(['knowledgeBase']);
  let records = data.knowledgeBase || [];

  // 兼容旧数据：没有 type 字段的记录默认为 translation
  records = records.map(record => {
    if (!record.type) {
      return { ...record, type: 'translation' };
    }
    return record;
  });

  // 按类型筛选
  if (type) {
    records = records.filter(record => record.type === type);
  }

  return records;
}

/**
 * 获取各类型的统计数量
 * @returns {Promise<Object>} 各类型数量
 */
export async function getTypeCounts() {
  const records = await getKnowledgeBase();
  const counts = {
    translation: 0,
    explanation: 0,
    summary: 0,
    collection: 0,
    total: records.length
  };

  records.forEach(record => {
    const type = record.type || 'translation';
    if (counts[type] !== undefined) {
      counts[type]++;
    }
  });

  return counts;
}

/**
 * 保存知识库数据
 * @param {Array} knowledgeBase - 知识库数组
 */
export async function saveKnowledgeBase(knowledgeBase) {
  await chrome.storage.local.set({ knowledgeBase });
}

/**
 * 添加记录到知识库
 * @param {Object} record - 记录对象
 */
export async function addRecord(record) {
  const knowledgeBase = await getKnowledgeBase();
  knowledgeBase.unshift({
    id: Date.now().toString(),
    ...record,
    timestamp: new Date().toISOString()
  });

  // 限制存储数量
  if (knowledgeBase.length > 10000) {
    knowledgeBase.pop();
  }

  await saveKnowledgeBase(knowledgeBase);
}

/**
 * 删除记录
 * @param {string} id - 记录 ID
 */
export async function deleteRecord(id) {
  const knowledgeBase = await getKnowledgeBase();
  const filtered = knowledgeBase.filter(item => item.id !== id);
  await saveKnowledgeBase(filtered);
}

/**
 * 清空知识库
 */
export async function clearKnowledgeBase() {
  await saveKnowledgeBase([]);
}

/**
 * 获取 AI 设置
 * @returns {Promise<Object>} AI 设置对象
 */
export async function getAISettings() {
  const data = await chrome.storage.sync.get(['aiSettings']);
  return data.aiSettings || {};
}

/**
 * 保存 AI 设置
 * @param {Object} settings - 设置对象
 */
export async function saveAISettings(settings) {
  await chrome.storage.sync.set({ aiSettings: settings });
}

/**
 * 获取统计数据
 * @param {string} type - 可选，按类型统计
 * @returns {Promise<Object>} 统计数据
 */
export async function getStats(type = null) {
  const knowledgeBase = await getKnowledgeBase(type);
  const today = new Date().toDateString();

  const todayCount = knowledgeBase.filter(item => {
    return new Date(item.timestamp).toDateString() === today;
  }).length;

  return {
    total: knowledgeBase.length,
    today: todayCount
  };
}

/**
 * 按类型清空知识库
 * @param {string} type - 可选，指定类型清空；不传则清空全部
 */
export async function clearKnowledgeByType(type = null) {
  if (!type) {
    await saveKnowledgeBase([]);
    return;
  }

  const data = await chrome.storage.local.get(['knowledgeBase']);
  const records = data.knowledgeBase || [];
  const filtered = records.filter(record => record.type !== type);
  await saveKnowledgeBase(filtered);
}
