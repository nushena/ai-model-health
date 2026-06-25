/**
 * Express 主服务
 * 提供 API 接口，服务前端页面
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const { startScheduler } = require('./scheduler');
const { getAllStatus } = require('./storage');

const app = express();
const PORT = process.env.PORT || 3000;

// 检查必要的环境变量
if (!process.env.OPENAI_API_KEY) {
  console.error('错误: 缺少 OPENAI_API_KEY 环境变量');
  console.error('请创建 .env 文件并设置 API 密钥');
  process.exit(1);
}

// 静态文件服务（前端页面）
app.use(express.static(path.join(__dirname, '../public')));

// API: 获取所有模型的当前状态
app.get('/api/status', (req, res) => {
  try {
    const status = getAllStatus();

    // 获取所有模型
    const models = Object.values(status.models);

    // 按批次对齐的数据结构
    const alignedModels = models.map(model => {
      const history = [];

      // 遍历所有批次，构建对齐的历史记录
      status.batches.forEach(batch => {
        const result = model.results[batch.id];

        if (result) {
          // 有检测结果
          history.push({
            success: result.success,
            latency: result.latency,
            error: result.error,
            timestamp: result.timestamp,
            status: result.success ? 'success' : 'failed'
          });
        } else if (batch.isCompleted) {
          // 批次已完成但没有检测结果，标记为"离线"（模型不在该批次列表中）
          history.push({
            success: null,
            latency: null,
            error: null,
            timestamp: batch.timestamp,
            status: 'offline'
          });
        } else {
          // 批次未完成，不显示该记录（等待检测）
          history.push({
            success: null,
            latency: null,
            error: null,
            timestamp: batch.timestamp,
            status: 'pending'
          });
        }
      });

      // 计算统计数据
      // 成功率 = 成功次数 / 总批次数（离线计入分母）
      const totalCount = history.length;
      const successCount = history.filter(h => h.success === true).length;
      const failedCount = history.filter(h => h.success === false).length;
      const offlineCount = history.filter(h => h.status === 'offline').length;

      const availabilityRate = totalCount > 0
        ? (successCount / totalCount * 100).toFixed(2)
        : 0;

      // 计算平均延迟（只统计成功的请求）
      const successResults = history.filter(h => h.success && h.latency);
      const avgLatency = successResults.length > 0
        ? Math.round(successResults.reduce((sum, h) => sum + h.latency, 0) / successResults.length)
        : 0;

      // 最新状态
      const testedResults = history.filter(h => h.status !== 'offline');
      const latestResult = testedResults[testedResults.length - 1];
      const isOnline = latestResult ? latestResult.success : false;
      const latency = latestResult ? latestResult.latency : null;
      const error = latestResult ? latestResult.error : null;
      const lastCheck = latestResult ? latestResult.timestamp : null;

      return {
        id: model.id,
        isOnline: isOnline,
        lastCheck: lastCheck,
        latency: latency,
        avgLatency: avgLatency,
        availabilityRate: parseFloat(availabilityRate),
        error: error,
        history: history,
        requestCount: totalCount,
        successCount: successCount,
        errorCount: failedCount,
        offlineCount: offlineCount
      };
    });

    // 计算总体统计
    const totalModels = alignedModels.length;
    const onlineModels = alignedModels.filter(m => m.isOnline).length;
    const overallHealth = totalModels > 0
      ? (onlineModels / totalModels * 100).toFixed(2)
      : 0;

    res.json({
      success: true,
      data: {
        lastUpdate: status.lastUpdate,
        summary: {
          total: totalModels,
          online: onlineModels,
          offline: totalModels - onlineModels,
          overallHealth: parseFloat(overallHealth)
        },
        models: alignedModels
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '获取状态失败'
    });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`AI 模型监控系统已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`=================================`);

  // 启动定时检测任务
  startScheduler();
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务...');
  process.exit(0);
});
