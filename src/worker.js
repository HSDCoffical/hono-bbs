export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 只响应 /test 路径
    if (url.pathname === '/test') {
      const GITHUB_TOKEN = env.GITHUB_TOKEN;

      if (!GITHUB_TOKEN) {
        return new Response(JSON.stringify({ error: '未配置 GITHUB_TOKEN 环境变量' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const testUrl = 'https://api.github.com/repos/HSDCofficial/astrowind';
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
          default_branch: data.default_branch,
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        const errorText = await resp.text();
        return new Response(JSON.stringify({
          ok: false,
          status: resp.status,
          detail: errorText,
        }), {
          status: resp.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 其他路径返回提示
    return new Response('请访问 /test 测试 Token', { status: 200 });
  }
};