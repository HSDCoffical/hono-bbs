import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import type { Bindings, Variables } from "../../types";

const circleCreate = new Hono<{ Bindings: Bindings; Variables: Variables }>();

circleCreate.get("/", async (c) => {
  const token = getCookie(c, "auth_token");
  if (!token) {
    return c.redirect("/auth/login");
  }

  const payload = await verify(token, c.env.JWT_SECRET) as any;
  const db = c.env.DB;
  const user = await db.prepare('SELECT id, username FROM users WHERE id = ?').bind(payload.id).first();

  return c.render(
    <div style={{ maxWidth: '500px', margin: '2rem auto' }}>
      <h1>➕ 创建圈子</h1>
      <p style={{ color: '#666' }}>创建一个属于你的小天地</p>

      {/* 注意：enctype="multipart/form-data" 必须加上 */}
      <form method="POST" action="/circles/create" enctype="multipart/form-data">
        <div>
          <label for="name">圈子名称 *</label>
          <input type="text" id="name" name="name" maxLength={30} required placeholder="2-30个字符" />
        </div>

        {/* 图标上传 - 改为必填 */}
        <div style={{ marginTop: '1rem' }}>
          <label for="icon">图标 *</label>
          <input
            type="file"
            id="icon"
            name="icon"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
            required
            style={{ display: 'block', marginTop: '0.3rem' }}
          />
          <small style={{ color: '#999', fontSize: '0.75rem' }}>
            支持 PNG、JPG、WebP、SVG、GIF，最大 10MB
          </small>
        </div>

        {/* 描述 - 改为必填 */}
        <div style={{ marginTop: '1rem' }}>
          <label for="description">描述 *</label>
          <textarea
            id="description"
            name="description"
            rows={3}
            required
            placeholder="这个圈子是关于什么的？"
            style={{ resize: 'vertical', width: '100%' }}
          ></textarea>
        </div>

        <button type="submit" role="button" style={{ marginTop: '1rem' }}>🚀 创建圈子</button>
      </form>
    </div>,
    {
      title: "创建圈子 - 凉宫社区",
      user: user,
    }
  );
});

circleCreate.post("/", async (c) => {
  const token = getCookie(c, "auth_token");
  if (!token) {
    return c.json({ error: '请先登录' }, 401);
  }

  const payload = await verify(token, c.env.JWT_SECRET) as any;
  const db = c.env.DB;

  // 使用 formData 解析 multipart/form-data
  const formData = await c.req.formData();
  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const iconFile = formData.get('icon') as File | null;

  // 验证：名称
  if (!name || name.length < 2) {
    return c.html('<p style="color:red;">圈子名称至少2个字符</p><a href="/circles/create">返回</a>');
  }
  if (name.length > 30) {
    return c.html('<p style="color:red;">圈子名称不能超过30个字符</p><a href="/circles/create">返回</a>');
  }

  // 验证：描述（必填）
  if (!description || description.trim().length < 1) {
    return c.html('<p style="color:red;">请填写圈子描述</p><a href="/circles/create">返回</a>');
  }

  // 验证：图标（必填）
  if (!iconFile || iconFile.size === 0) {
    return c.html('<p style="color:red;">请上传圈子图标</p><a href="/circles/create">返回</a>');
  }

  // 验证文件类型
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'];
  if (!allowedTypes.includes(iconFile.type)) {
    return c.html('<p style="color:red;">不支持的文件格式，请上传 PNG、JPG、WebP、SVG 或 GIF</p><a href="/circles/create">返回</a>');
  }

  // 验证文件大小（10MB）
  if (iconFile.size > 10 * 1024 * 1024) {
    return c.html('<p style="color:red;">文件大小不能超过 10MB</p><a href="/circles/create">返回</a>');
  }

  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  // 检查是否已存在同名圈子
  const existing = await db.prepare('SELECT id FROM circles WHERE slug = ?').bind(slug).first();
  if (existing) {
    return c.html(`<p style="color:red;">圈子名称已存在，请换一个</p><a href="/circles/create">返回</a>`);
  }

  try {
    // ===== 1. 上传图标到 GitHub =====
    const GITHUB_TOKEN = c.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
      return c.html('<p style="color:red;">服务器未配置 GitHub Token，请联系管理员</p><a href="/circles/create">返回</a>');
    }

    const repo = 'HSDCoffical/workshop';
    const uploadDir = 'workshop';

    // 读取文件并转为 Base64
    const arrayBuffer = await iconFile.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    const timestamp = Date.now();
    const safeName = iconFile.name.replace(/[^a-zA-Z0-9.\u4e00-\u9fa5]/g, '_');
    const filename = `${timestamp}-${safeName}`;
    const path = uploadDir ? `${uploadDir}/${filename}` : filename;

    // 上传到 GitHub
    const githubUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
    const uploadResp = await fetch(githubUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Hono-BBS-App/1.0'
      },
      body: JSON.stringify({
        message: `上传圈子图标: ${iconFile.name}`,
        content: base64,
      }),
    });

    if (!uploadResp.ok) {
      let detail = await uploadResp.text();
      try {
        const json = JSON.parse(detail);
        detail = json.message || json.errors || detail;
      } catch (_) {}
      return c.html(`<p style="color:red;">图标上传失败: ${uploadResp.status} - ${detail}</p><a href="/circles/create">返回</a>`);
    }

    const uploadData = await uploadResp.json();
    // 获取图标的 raw 链接
    const iconUrl = `https://raw.githubusercontent.com/${repo}/main/${path}`;

    // ===== 2. 创建圈子（存储图标 URL） =====
    await db.prepare(`
      INSERT INTO circles (name, slug, description, icon, creator_id)
      VALUES (?, ?, ?, ?, ?)
    `).bind(name, slug, description.trim(), iconUrl, payload.id).run();

    // 通过 slug 查询刚创建的圈子 ID
    const circle = await db.prepare('SELECT id FROM circles WHERE slug = ?').bind(slug).first();

    if (!circle || !circle.id) {
      return c.html('<p style="color:red;">创建失败，未找到新创建的圈子</p><a href="/circles/create">返回</a>');
    }

    const circleId = circle.id;

    // 将创建者加入圈子（作为管理员）
    await db.prepare(`
      INSERT INTO circle_members (circle_id, user_id, role)
      VALUES (?, ?, 'admin')
    `).bind(circleId, payload.id).run();

    return c.redirect(`/circles/${circleId}`);

  } catch (error: any) {
    console.error('创建圈子错误:', error);
    return c.html(`<p style="color:red;">创建失败：${error.message || '未知错误'}</p><a href="/circles/create">返回</a>`);
  }
});

export { circleCreate };