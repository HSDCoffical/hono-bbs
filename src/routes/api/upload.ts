import { Hono } from 'hono';

const app = new Hono();

app.post('/', async (c) => {
  try {
    const GITHUB_TOKEN = c.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
      return c.json({ error: '服务器配置错误：未配置 GITHUB_TOKEN 环境变量' }, 500);
    }

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

    const githubUrl = `https://api.github.com/repos/HSDCofficial/astrowind/contents/workshop/${filename}`;
    const resp = await fetch(githubUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `上传: ${file.name}`,
        content: base64,
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return c.json({ error: `GitHub 上传失败: ${resp.status}`, detail }, 500);
    }

    const data = await resp.json();
    return c.json({
      success: true,
      filename: filename,
      url: `https://github.com/HSDCofficial/astrowind/blob/main/workshop/${filename}?raw=true`,
      github_data: data,
    });
  } catch (e) {
    return c.json({ error: `上传服务异常: ${(e as Error).message}` }, 500);
  }
});

export default app;
