import { Hono } from 'hono';

const app = new Hono();

app.post('/upload', async (c) => {
  try {
    const GITHUB_TOKEN = c.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
      return c.json({ error: '未配置 GITHUB_TOKEN' }, 500);
    }

    // ========== 直接写死仓库和目录 ==========
    const repo = 'HSDCofficial/astrowind';   // 确认拼写正确
    const uploadDir = 'workshop';            // 确认目录存在

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

    const githubUrl = `https://api.github.com/repos/${repo}/contents/${uploadDir}/${filename}`;

    const resp = await fetch(githubUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Hono-BBS-App/1.0'   // 必加
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
      } catch (_) { /* 保留原文 */ }

      return c.json({
        error: `GitHub 上传失败: ${resp.status}`,
        detail,
        requested_url: githubUrl  // 方便核对
      }, 500);
    }

    const data = await resp.json();
    return c.json({
      success: true,
      filename,
      url: `https://github.com/${repo}/blob/main/${uploadDir}/${filename}?raw=true`,
      github_data: data,
    });
  } catch (e) {
    return c.json({ error: `上传服务异常: ${(e as Error).message}` }, 500);
  }
});

export default app;