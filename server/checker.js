/**
 * 模型检测核心逻辑
 * 负责调用 OpenAI API 检测模型可用性
 */

const OpenAI = require('openai');

// 初始化 OpenAI 客户端
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
  defaultHeaders: {
    'User-Agent': 'Claude-Code/2.1.159 (Windows NT 10.0; Node.js)'
  }
});

// 最小测试消息池（随机选择以避免被识别为固定模式）
const TEST_MESSAGES = [
  'hi',
  'ok',
  '1+1=?',
  '测试',
  'hello',
  'test',
  '你好',
  'ping'
];

/**
 * 获取随机延迟时间（0.5-2 秒）
 * @returns {number} 延迟毫秒数
 */
function getRandomDelay() {
  return Math.floor(Math.random() * 1500) + 500; // 500-2000ms
}

/**
 * 从消息池中随机选择一条测试消息
 * @returns {string} 随机选中的测试消息
 */
function getRandomTestMessage() {
  return TEST_MESSAGES[Math.floor(Math.random() * TEST_MESSAGES.length)];
}

/**
 * 获取可用的模型列表
 * @returns {Promise<Array>} 模型 ID 数组
 */
async function getAvailableModels() {
  try {
    // 调用 OpenAI API 获取模型列表
    const response = await client.models.list();

    // 提取所有模型的 ID 并按字母数字顺序排序
    const models = response.data
      .map(model => model.id)
      .sort((a, b) => {
        // 自然排序（A-Z, 0-9）
        return a.localeCompare(b, undefined, {
          numeric: true,
          sensitivity: 'base'
        });
      });

    console.log(`从 API 获取到 ${models.length} 个模型`);
    return models;
  } catch (error) {
    console.error('获取模型列表失败:', error.message);
    return [];
  }
}

/**
 * 检测单个模型的可用性
 * @param {string} modelId - 模型 ID
 * @returns {Promise<Object>} 检测结果 { success, latency, error, timestamp }
 */
async function checkModel(modelId) {
  const startTime = Date.now();
  const testMessage = getRandomTestMessage();

  try {
    // 设置 30 秒超时
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('请求超时（30秒）')), 30000);
    });

    const requestPromise = client.chat.completions.create({
      model: modelId,
      max_tokens: Math.floor(Math.random() * 5) + 1, // 1-5 随机 token
      messages: [
        {
          role: 'user',
          content: testMessage
        }
      ]
    });

    // 使用 Promise.race 实现超时控制
    const response = await Promise.race([requestPromise, timeoutPromise]);

    const latency = Date.now() - startTime;

    return {
      success: true,
      latency: latency,
      error: null,
      timestamp: Date.now(),
      testMessage: testMessage
    };
  } catch (error) {
    const latency = Date.now() - startTime;

    return {
      success: false,
      latency: latency,
      error: error.message,
      timestamp: Date.now(),
      testMessage: testMessage
    };
  }
}

/**
 * 添加随机延迟（避免请求过于规律）
 * @returns {Promise<void>}
 */
function randomDelay() {
  const delay = getRandomDelay();
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * 检测所有模型
 * @param {Function} onProgress - 每检测完一个模型的回调函数
 * @returns {Promise<Array>} 所有模型的检测结果数组
 */
async function checkAllModels(onProgress) {
  const models = await getAvailableModels();
  const results = [];

  console.log(`开始检测 ${models.length} 个模型...`);

  for (const modelId of models) {
    console.log(`正在检测: ${modelId}`);
    const result = await checkModel(modelId);
    const fullResult = {
      modelId,
      ...result
    };
    results.push(fullResult);

    // 实时回调，让调用者可以立即处理结果
    if (onProgress) {
      onProgress(fullResult);
    }

    // 在每个模型检测之间加入随机延迟
    if (models.indexOf(modelId) < models.length - 1) {
      await randomDelay();
    }
  }

  console.log('所有模型检测完成');
  return results;
}

module.exports = {
  getAvailableModels,
  checkModel,
  checkAllModels
};
