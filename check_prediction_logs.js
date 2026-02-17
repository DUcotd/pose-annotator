// 快速检查预标注任务日志的脚本
const http = require('http');

const projectId = 'yu'; // 从终端日志中看到的项目ID

const options = {
  hostname: 'localhost',
  port: 5000,
  path: `/api/projects/${encodeURIComponent(projectId)}/predict/status`,
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('\n=== 预标注任务状态 ===');
      console.log('状态:', result.status);
      console.log('进度:', result.progress + '%');
      console.log('当前/总数:', result.current + '/' + result.total);
      console.log('\n=== 日志信息 ===');
      
      if (result.logs && result.logs.length > 0) {
        result.logs.forEach((log, index) => {
          const time = new Date(log.time).toLocaleTimeString();
          const type = log.type || 'info';
          const icon = {
            'error': '❌',
            'stderr': '🔴',
            'system': 'ℹ️',
            'suggestion': '💡',
            'stdout': '📝'
          }[type] || '›';
          
          console.log(`[${time}] ${icon} [${type}] ${log.msg}`);
        });
      } else {
        console.log('没有日志记录');
      }
      
      console.log('\n=== 错误日志 ===');
      // 如果有错误日志，显示最后20条
      const errorLogs = result.logs ? result.logs.filter(l => 
        l.type === 'error' || l.type === 'stderr' || 
        (l.msg && (l.msg.includes('ERROR') || l.msg.includes('错误')))
      ) : [];
      
      if (errorLogs.length > 0) {
        errorLogs.slice(-20).forEach(log => {
          console.log(log.msg);
        });
      } else {
        console.log('没有错误日志（这可能意味着错误没有被正确捕获）');
      }
      
    } catch (e) {
      console.error('解析响应失败:', e);
      console.log('原始响应:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`请求失败: ${e.message}`);
});

req.end();
