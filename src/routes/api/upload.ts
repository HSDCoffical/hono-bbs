import { Hono } from 'hono';

const app = new Hono();

app.post('/upload', async (c) => {
  try {
    // 1. 检查 GITHUB_TOKEN 是否存在
    const GITHUB_TOKEN = c.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
      return c.json({ error: '服务器配置错误：未配置 GITHUB_TOKEN 环境变量' }, 500);
    }

    // 2. 解析表单数据
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return c.json({ error: '请选择文件' }, 400);
    }

    if (file.size > 10 * 1024 * 1024) {
      return c.json({ error: '文件大小不能超过 10MB' }, 400);
    }

    // 3. 构造文件名和内容
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.\u4e00-\u9fa5]/g, '_');
    const filename = `${timestamp}-${safeName}`;

    // 4. 读取文件并转 base64
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    // 5. 使用环境变量配置仓库（如果未设置则使用默认）
    const repo = c.env.GITHUB_REPO || 'HSDCofficial/astrowind';
    const uploadDir = c.env.GITHUB_UPLOAD_DIR || 'workshop';
    const path = uploadDir ? `${uploadDir}/${filename}` : filename;
    const githubUrl = `https://api.github.com/repos/${repo}/contents/${path}`;

    // 6. 发送到 GitHub API
    const resp = await fetch(githubUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Hono-BBS-App/1.0'
      },
      body: JSON.stringify({
        message: `上传: ${file.name}`,
        content: base64,
      }),
    });

    // 7. 处理 GitHub 响应
    if (!resp.ok) {
      let detail = await resp.text();
      try {
        const json = JSON.parse(detail);
        detail = json.message || json.errors || detail;
      } catch (_) { /* 保持原样 */ }

      return c.json({
        error: `GitHub 上传失败: ${resp.status}`,
        detail,
        status: resp.status,
        statusText: resp.statusText
      }, 500);
    }

    const data = await resp.json();
    return c.json({
      success: true,
      filename,
      url: `https://github.com/${repo}/blob/main/${path}?raw=true`,
      github_data: data,
    });
  } catch (e) {
    // ★ 关键：捕获所有未预期的异常，返回 JSON 而不是抛出 ★
    console.error('Upload error:', e);
    return c.json({
      error: `上传服务异常: ${(e as Error).message}`,
      stack: (e as Error).stack
    }, 500);
  }
});

export default app;