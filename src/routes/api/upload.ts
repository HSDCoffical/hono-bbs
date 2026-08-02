import { Hono } from 'hono';

const app = new Hono();

app.post('/upload', async (c) => {
  try {
    const GITHUB_TOKEN = c.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
      return c.json({ error: '未配置 GITHUB_TOKEN 环境变量' }, 500);
    }

    // ★ 直接写死您的仓库（不需要任何环境变量） ★
    const repo = 'HSDCoffical/workshop';   // ← 改成您的用户名/仓库名
    const uploadDir = 'workshop';                // ← 您创建的目录名

    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return c.json({ error: '请选择文件' }, 400);
    }

    if (file.size > 10 * 1024 * 1024) {
      return c.json({ error: '文件大小不能超过 10MB' }, 400);
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
        detail = json.message || json.errors || detail;
      } catch (_) { /* 保持原样 */ }

      return c.json({
        error: `GitHub 上传失败: ${resp.status}`,
        detail,
        requested_url: githubUrl,
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
    console.error('Upload error:', e);
    return c.json({
      error: `上传服务异常: ${(e as Error).message}`,
    }, 500);
  }
});

export default app;