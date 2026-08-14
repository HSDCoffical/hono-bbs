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

      <form method="POST" action="/circles/create">
        <div>
          <label for="name">圈子名称 *</label>
          <input type="text" id="name" name="name" maxLength={30} required placeholder="2-30个字符" />
        </div>
        <div style={{ marginTop: '1rem' }}>
          <label for="icon">图标 (可选)</label>
          <input type="text" id="icon" name="icon" placeholder="📁" maxLength={2} />
        </div>
        <div style={{ marginTop: '1rem' }}>
          <label for="description">描述 (可选)</label>
          <textarea id="description" name="description" rows={3} placeholder="这个圈子是关于什么的？" style={{ resize: 'vertical' }}></textarea>
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
  const formData = await c.req.formData();
  const name = formData.get('name') as string;
  const description = formData.get('description') as string || '';
  const icon = formData.get('icon') as string || '📁';

  if (!name || name.length < 2) {
    return c.html('<p style="color:red;">圈子名称至少2个字符</p><a href="/circles/create">返回</a>');
  }
  if (name.length > 30) {
    return c.html('<p style="color:red;">圈子名称不能超过30个字符</p><a href="/circles/create">返回</a>');
  }

  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const existing = await db.prepare('SELECT id FROM circles WHERE slug = ?').bind(slug).first();
  if (existing) {
    return c.html('<p style="color:red;">圈子名称已存在，请换一个</p><a href="/circles/create">返回</a>');
  }

  const result = await db.prepare(`
    INSERT INTO circles (name, slug, description, icon, creator_id)
    VALUES (?, ?, ?, ?, ?)
    RETURNING id
  `).bind(name, slug, description, icon, payload.id).first();

  await db.prepare(`
    INSERT INTO circle_members (circle_id, user_id, role)
    VALUES (?, ?, 'admin')
  `).bind(result.id, payload.id).run();

  return c.redirect(`/circles/${result.id}`);
});

export { circleCreate };