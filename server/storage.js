/**
 * 数据持久化模块
 * 负责存储模型检测结果到 SQLite 数据库
 * 使用批次（batch）对齐的时间轴结构
 */

const db = require('./database');

// 初始化数据库
db.initDatabase();

/**
 * 创建新批次
 * @param {Array} modelIds - 本批次要检测的模型 ID 列表（兼容参数，实际不使用）
 * @returns {string} 批次 ID
 */
function createBatch(modelIds = []) {
  const batchId = `batch-${Date.now()}`;
  const timestamp = Date.now();

  // 创建批次记录
  db.createBatch(batchId, timestamp);

  console.log(`创建批次: ${batchId}`);
  return batchId;
}

/**
 * 更新单个模型在特定批次的检测结果
 * @param {string} batchId - 批次 ID
 * @param {string} modelId - 模型 ID
 * @param {Object} result - 检测结果 { success, latency, error, timestamp }
 */
function updateModelResult(batchId, modelId, result) {
  // 直接写入数据库
  db.upsertResult(batchId, modelId, result);
}

/**
 * 获取所有模型的当前状态
 * @returns {Object} 包含批次和模型状态的对象
 */
function getAllStatus() {
  // 从数据库读取所有批次
  const batches = db.getAllBatches();

  // 构建批次列表（保持原有结构）
  const batchList = batches.map(batch => ({
    id: batch.id,
    timestamp: batch.timestamp,
    modelIds: db.getModelIdsByBatch(batch.id)
  }));

  // 获取所有模型 ID
  const modelIds = db.getAllModelIds();

  // 构建模型数据
  const models = {};
  modelIds.forEach(modelId => {
    const results = db.getResultsByModel(modelId);

    // 转换为原有格式：{batchId: {success, latency, error, timestamp}}
    const resultsByBatch = {};
    results.forEach(r => {
      resultsByBatch[r.batch_id] = {
        success: r.success === 1,
        latency: r.latency,
        error: r.error,
        timestamp: r.timestamp
      };
    });

    models[modelId] = {
      id: modelId,
      results: resultsByBatch
    };
  });

  // 获取最新更新时间
  const lastUpdate = batches.length > 0 ? batches[0].timestamp : null;

  return {
    lastUpdate: lastUpdate,
    batches: batchList,
    models: models
  };
}

/**
 * 清理过期数据
 * @param {number} retentionDays - 保留天数（默认 14 天）
 * @returns {Object} 清理统计
 */
function cleanupOldData(retentionDays = 14) {
  const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const stats = db.cleanupOldData(cutoffTime);

  console.log(`清理完成: 删除 ${stats.deletedBatches} 个批次，${stats.deletedResults} 条检测记录`);
  return stats;
}

module.exports = {
  createBatch,
  updateModelResult,
  getAllStatus,
  cleanupOldData
};
