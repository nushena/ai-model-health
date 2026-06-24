/**
 * 定时任务调度器
 * 负责按配置的时间间隔执行模型检测
 * 采用"完成后等待"模式，而不是固定间隔
 */

const { checkAllModels } = require('./checker');
const { createBatch, updateModelResult, cleanupOldData } = require('./storage');

let checkTimeoutId = null;
let cleanupTimeoutId = null;
let isChecking = false; // 检测进行中标志

/**
 * 执行一次完整的检测任务
 */
async function runCheckTask() {
  // 如果上一次检测还在进行中，跳过本次
  if (isChecking) {
    console.log(`[${new Date().toLocaleString('zh-CN')}] 上一次检测仍在进行中，跳过本次检测`);
    return;
  }

  isChecking = true;
  const startTime = Date.now();
  console.log(`[${new Date().toLocaleString('zh-CN')}] 开始执行定时检测任务`);

  let batchId = null;
  let successCount = 0;
  let totalCount = 0;

  try {
    // 先创建批次占位（这样前端能看到有新的检测开始了）
    // 但此时还不知道会检测哪些模型，等第一个结果出来再更新

    const results = await checkAllModels((result) => {
      // 每检测完一个模型，实时写入
      totalCount++;

      // 第一个模型检测完成时创建批次
      if (!batchId) {
        batchId = createBatch([]); // 先创建空批次
        console.log(`创建批次: ${batchId}`);
      }

      // 立即写入这个模型的结果
      updateModelResult(batchId, result.modelId, {
        success: result.success,
        latency: result.latency,
        error: result.error,
        timestamp: result.timestamp
      });

      if (result.success) {
        successCount++;
      }

      // 每检测完 10 个模型输出一次进度
      if (totalCount % 10 === 0) {
        console.log(`进度: ${totalCount} 个模型已检测，${successCount} 个在线`);
      }
    });

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`检测完成: ${successCount}/${results.length} 个模型在线，耗时 ${duration} 秒`);
  } catch (error) {
    console.error('检测任务执行失败:', error.message);
  } finally {
    isChecking = false;

    // 检测完成后，等待 X 分钟再开始下一轮
    scheduleNextCheck();
  }
}

/**
 * 安排下一次检测
 */
function scheduleNextCheck() {
  const intervalMinutes = parseInt(process.env.CHECK_INTERVAL_MINUTES) || 5;
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`下一轮检测将在 ${intervalMinutes} 分钟后开始`);

  // 清除旧的定时器
  if (checkTimeoutId) {
    clearTimeout(checkTimeoutId);
  }

  // 设置新的定时器
  checkTimeoutId = setTimeout(() => {
    runCheckTask();
  }, intervalMs);
}

/**
 * 执行数据清理任务
 */
function runCleanupTask() {
  const retentionDays = parseInt(process.env.DATA_RETENTION_DAYS) || 14;
  console.log(`[${new Date().toLocaleString('zh-CN')}] 开始清理 ${retentionDays} 天前的数据`);

  try {
    const stats = cleanupOldData(retentionDays);
    console.log(`清理完成: 删除了 ${stats.deletedBatches} 个批次，${stats.deletedResults} 条检测记录`);
  } catch (error) {
    console.error('数据清理失败:', error.message);
  }

  // 安排下一次清理（每天凌晨 3 点执行）
  scheduleNextCleanup();
}

/**
 * 安排下一次数据清理
 */
function scheduleNextCleanup() {
  // 计算距离明天凌晨 3 点的时间
  const now = new Date();
  const next = new Date();
  next.setHours(3, 0, 0, 0);

  // 如果今天的 3 点已经过了，设置为明天 3 点
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  const delayMs = next.getTime() - now.getTime();
  const delayHours = Math.round(delayMs / 1000 / 60 / 60);

  console.log(`下一次数据清理将在 ${delayHours} 小时后执行（${next.toLocaleString('zh-CN')}）`);

  // 清除旧的定时器
  if (cleanupTimeoutId) {
    clearTimeout(cleanupTimeoutId);
  }

  // 设置新的定时器
  cleanupTimeoutId = setTimeout(() => {
    runCleanupTask();
  }, delayMs);
}

/**
 * 启动定时任务
 */
function startScheduler() {
  const intervalMinutes = parseInt(process.env.CHECK_INTERVAL_MINUTES) || 5;

  console.log(`定时任务已启动，每轮检测完成后等待 ${intervalMinutes} 分钟再开始下一轮`);

  // 立即执行第一次检测
  runCheckTask();

  // 启动数据清理任务
  scheduleNextCleanup();
}

/**
 * 停止定时任务
 */
function stopScheduler() {
  if (checkTimeoutId) {
    clearTimeout(checkTimeoutId);
    checkTimeoutId = null;
  }

  if (cleanupTimeoutId) {
    clearTimeout(cleanupTimeoutId);
    cleanupTimeoutId = null;
  }

  console.log('定时任务已停止');
}

module.exports = {
  startScheduler,
  stopScheduler,
  runCheckTask
};
