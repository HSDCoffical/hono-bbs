import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import type { Bindings, Variables } from "../../types";

const bottleSend = new Hono<{ Bindings: Bindings; Variables: Variables }>();

bottleSend.get("/", async (c) => {
  const token = getCookie(c, "auth_token");
  if (!token) {
    return c.redirect("/auth/login");
  }

  const payload = await verify(token, c.env.JWT_SECRET) as any;
  const db = c.env.DB;
  const user = await db.prepare('SELECT id, username FROM users WHERE id = ?').bind(payload.id).first();

  const todayCount = await db.prepare(`
    SELECT COUNT(*) as count FROM bottles
    WHERE sender_user_id = ? AND date(created_at) = date('now')
  `).bind(payload.id).first();

  const alreadySent = (todayCount?.count || 0) >= 1;

  return c.render(
    <div style={{ maxWidth: '500px', margin: '2rem auto' }}>
      <h1>📤 投一个瓶子</h1>
      <p style={{ color: '#666' }}>写一段话，装进瓶子，漂向大海</p>

      {alreadySent ? (
        <div style={{ padding: '2rem', background: '#fff3e0', borderRadius: '12px', textAlign: 'center' }}>
          <p style={{ fontSize: '1.2rem' }}>🌊 你今天已经投过一个瓶子了</p>
          <p style={{ color: '#666' }}>明天再来吧</p>
          <a href="/bottle" role="button" class="outline" style={{ marginTop: '1rem' }}>返回漂流瓶</a>
        </div>
      ) : (
        <form method="POST" action="/bottle/send">
          <div>
            <label for="content">内容 (最多200字)</label>
            <textarea id="content" name="content" rows={4} maxLength={200} required style={{ resize: 'vertical' }}></textarea>
            <small style={{ display: 'block', textAlign: 'right', color: '#999' }} id="char-count">0 / 200</small>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <label>
              <input type="checkbox" name="is_anonymous" value="true" />
              匿名投瓶
            </label>
          </div>
          <button type="submit" role="button" style={{ marginTop: '1rem' }}>📤 投出瓶子</button>
        </form>
      )}
    </div>,
    {
      title: "投瓶子 - 凉宫社区",
      user: user,
    }
  );
});

bottleSend.post("/", async (c) => {
  const token = getCookie(c, "auth_token");
  if (!token) {
    return c.json({ error: '请先登录' }, 401);
  }

  const payload = await verify(token, c.env.JWT_SECRET) as any;
  const db = c.env.DB;
  const formData = await c.req.formData();
  const content = formData.get('content') as string;
  const is_anonymous = formData.get('is_anonymous') === 'true';

  if (!content || content.trim().length < 1) {
    return c.html('<p style="color:red;">内容不能为空</p><a href="/bottle/send">返回</a>');
  }
  if (content.length > 200) {
    return c.html('<p style="color:red;">内容不能超过200字</p><a href="/bottle/send">返回</a>');
  }

  const todayCount = await db.prepare(`
    SELECT COUNT(*) as count FROM bottles
    WHERE sender_user_id = ? AND date(created_at) = date('now')
  `).bind(payload.id).first();

  if ((todayCount?.count || 0) >= 1) {
    return c.html('<p style="color:red;">你今天已经投过瓶子了</p><a href="/bottle/send">返回</a>');
  }

  await db.prepare(`
    INSERT INTO bottles (sender_user_id, content, is_anonymous, status)
    VALUES (?, ?, ?, 'drifting')
  `).bind(payload.id, content.trim(), is_anonymous).run();

  return c.redirect('/bottle');
});

export { bottleSend };
