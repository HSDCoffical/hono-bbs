import { Hono } from 'hono';

const app = new Hono();

app.post('/upload', async (c) => {
  try {
    const GITHUB_TOKEN = c.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
      return c.json({ error: '服务器配置错误：未配置 GITHUB_TOKEN 环境变量' }, 500);
    }

    // 验证 Token 格式（简单检查是否以 ghp_ 开头）
    if (!GITHUB_TOKEN.startsWith('ghp_') && !GITHUB_TOKEN.startsWith('github_pat_')) {
      return c.json({ 
        error: 'GitHub Token 格式无效', 
        detail: 'Token 应以 ghp_ 或 github_pat_ 开头，请检查环境变量设置' 
      }, 500);
    }

    // 从环境变量获取仓库路径，默认使用 HSDCofficial/astrowind
    const repo = c.env.GITHUB_REPO || 'HSDCofficial/astrowind';
    const uploadDir = c.env.GITHUB_UPLOAD_DIR || 'workshop';

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

    const githubUrl = `https://api.github.com/repos/${repo}/contents/${uploadDir}/${filename}`;
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

      // 针对 401 特别提示
      if (resp.status === 401) {
        return c.json({
          error: 'GitHub 认证失败（401）',
          detail: '请检查 GITHUB_TOKEN 是否过期、被撤销或权限不足。需要 repo 或 public_repo 权限。',
          github_response: detail
        }, 500);
      }

      return c.json(
        { 
          error: `GitHub 上传失败: ${resp.status}`, 
          detail,
          status: resp.status,
          statusText: resp.statusText
        }, 
        500
      );
    }

    const data = await resp.json();
    return c.json({
      success: true,
      filename: filename,
      url: `https://github.com/${repo}/blob/main/${uploadDir}/${filename}?raw=true`,
      github_data: data,
    });
  } catch (e) {
    return c.json({ error: `上传服务异常: ${(e as Error).message}` }, 500);
  }
});

export default app;