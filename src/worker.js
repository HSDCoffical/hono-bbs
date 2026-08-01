// ===== 配置区（修改这里） =====
const GITHUB_REPO = 'HSDCofficial/astrowind';
const GITHUB_PATH = 'workshop/';
// ============================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const GITHUB_TOKEN = env.GITHUB_TOKEN;

    // ===== 测试路由：验证 Token 是否有效 =====
    if (url.pathname === '/test') {
      if (!GITHUB_TOKEN) {
        return new Response(JSON.stringify({ error: '未配置 GITHUB_TOKEN 环境变量' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // 测试 Token 是否能读取仓库
      const testUrl = `https://api.github.com/repos/${GITHUB_REPO}`;
      const resp = await fetch(testUrl, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (resp.ok) {
        const data = await resp.json();
        return new Response(JSON.stringify({
          ok: true,
          repo: data.full_name,
          private: data.private,
          default_branch: data.default_branch,
        }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      } else {
        const errorText = await resp.text();
        return new Response(JSON.stringify({
          ok: false,
          status: resp.status,
          detail: errorText,
        }), {
          status: resp.status,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
    }

    // ===== 原有上传/文件列表/删除等逻辑 =====
    // （下面代码保持不变，但为了完整我重新贴一遍）
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/upload') {
      try {
        if (!GITHUB_TOKEN) {
          return new Response(JSON.stringify({ error: '服务器配置错误：缺少 GITHUB_TOKEN 环境变量' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }

        const formData = await request.formData();
        const file = formData.get('file');
        const uploader = formData.get('uploader') || '匿名';

        if (!file) {
          return new Response(JSON.stringify({ error: '请选择文件' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }

        if (file.size > 10 * 1024 * 1024) {
          return new Response(JSON.stringify({ error: '文件大小不能超过 10MB' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
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

        const githubUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_PATH}${filename}`;
        const response = await fetch(githubUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `上传: ${file.name} 由 ${uploader}`,
            content: base64,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          let detail = errorText;
          try {
            const parsed = JSON.parse(errorText);
            if (parsed.message) detail = parsed.message;
            if (parsed.errors) detail += ' | ' + JSON.stringify(parsed.errors);
          } catch (_) {}
          return new Response(JSON.stringify({
            error: `GitHub 上传失败: ${response.status}`,
            detail: detail
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }

        await env.DB.prepare(
          `INSERT INTO files (filename, original_name, size, uploader) VALUES (?, ?, ?, ?)`
        ).bind(filename, file.name, file.size, uploader).run();

        return new Response(JSON.stringify({
          success: true,
          filename: filename,
          url: `https://github.com/${GITHUB_REPO}/blob/main/${GITHUB_PATH}${filename}?raw=true`,
        }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });

      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, detail: e.stack }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
    }

    if (request.method === 'GET' && url.pathname === '/files') {
      try {
        const result = await env.DB.prepare(
          `SELECT id, filename, original_name, size, uploader, created_at FROM files ORDER BY created_at DESC`
        ).all();
        return new Response(JSON.stringify(result.results), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
    }

    if (request.method === 'DELETE' && url.pathname.startsWith('/files/')) {
      const filename = url.pathname.replace('/files/', '');
      try {
        await env.DB.prepare(`DELETE FROM files WHERE filename = ?`).bind(filename).run();
        const githubUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_PATH}${filename}`;
        const getResp = await fetch(githubUrl, {
          headers: { 'Authorization': `token ${GITHUB_TOKEN}` },
        });
        if (getResp.ok) {
          const data = await getResp.json();
          await fetch(githubUrl, {
            method: 'DELETE',
            headers: {
              'Authorization': `token ${GITHUB_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: `删除: ${filename}`,
              sha: data.sha,
            }),
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
    }

    return new Response('接口可用', { status: 200 });
  }
};