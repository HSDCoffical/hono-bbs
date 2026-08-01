import { Hono } from 'hono';

const app = new Hono();

app.post('/upload', async (c) => {
  try {
    const GITHUB_TOKEN = c.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
      return c.json({ error: '未配置 GITHUB_TOKEN' }, 500);
    }

    // 🔧 修改为您的 GitHub 用户名和仓库名（不要加 https://）
    const repo = 'HSDCoffical/workshop';   // 例如 'zhangsan/my-images'
    const uploadDir = '';              // 空字符串 = 根目录

    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return c.json({ error: '请选择文件' }, 400);
    }

    if (file.size > 10 * 1024 * 1024) {
      return c.json({ error: '文件大小超过 10MB' }, 400);
    }

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.\u4e00-\u9fa5]/g, '_');
    const filename = `${timestamp}-${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    // 处理路径：如果 uploadDir 为空，直接使用文件名
    const path = uploadDir ? `${uploadDir}/${filename}` : filename;
    const githubUrl = `https://api.github.com/repos/${repo}/contents/${path}`;

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

    if (!resp.ok) {
      let detail = await resp.text();
      try {
        const json = JSON.parse(detail);
        detail = JSON.stringify(json, null, 2);
      } catch (_) { /* 保留原文本 */ }

      return c.json({
        error: `GitHub 上传失败: ${resp.status}`,
        detail,
        requested_url: githubUrl
      }, 500);
    }

    const data = await resp.json();
    // 返回的 URL 也使用 path
    return c.json({
      success: true,
      filename,
      url: `https://github.com/${repo}/blob/main/${path}?raw=true`,
      github_data: data,
    });
  } catch (e) {
    return c.json({ error: `上传服务异常: ${(e as Error).message}` }, 500);
  }
});

export default app;