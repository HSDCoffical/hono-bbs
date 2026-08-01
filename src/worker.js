// ===== 测试路由：验证 Token 是否有效 =====
if (url.pathname === '/test') {
  if (!GITHUB_TOKEN) {
    return new Response(JSON.stringify({ error: '未配置 GITHUB_TOKEN 环境变量' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

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