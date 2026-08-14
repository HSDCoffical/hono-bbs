import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import type { Bindings, Variables } from "../../types";

const bottle = new Hono<{ Bindings: Bindings; Variables: Variables }>();

bottle.get("/", async (c) => {
  const db = c.env.DB;
  const token = getCookie(c, "auth_token");
  let user = null;

  if (token) {
    try {
      const payload = await verify(token, c.env.JWT_SECRET) as any;
      user = await db.prepare('SELECT id, username, avatar FROM users WHERE id = ?').bind(payload.id).first();
    } catch (e) {}
  }

  const bottleCount = await db.prepare(
    "SELECT COUNT(*) as count FROM bottles WHERE status = 'drifting'"
  ).first();

  let history: any[] = [];
  if (user) {
    const result = await db.prepare(`
      SELECT * FROM bottles
      WHERE sender_user_id = ? OR picked_by_user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).bind(user.id, user.id).all();
    history = result.results || [];
  }

  return c.render(
    <div class="container" style="padding: 1rem 0; max-width: 600px; margin: 0 auto;">
      <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        <h1>🍶 漂流瓶</h1>
        <p style={{ color: '#666' }}>把心事装进瓶子，漂向未知的远方</p>
      </div>

      <div style={{ background: 'linear-gradient(135deg, #f0f7ff 0%, #e8f4f8 100%)', borderRadius: '16px', padding: '2rem', textAlign: 'center', marginTop: '1.5rem' }}>
        <div style={{ fontSize: '4rem' }}>🍾</div>
        <p style={{ margin: '0.5rem 0 0' }}>
          {bottleCount?.count > 0
            ? `🌊 有 ${bottleCount.count} 个瓶子在海上漂着`
            : '🌊 海面很平静，投一个瓶子吧'}
        </p>

        {user ? (
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <a href="/bottle/send" role="button">📤 投一个</a>
            <a href="/bottle/pick" role="button" class="outline">🎣 捞一个</a>
          </div>
        ) : (
          <div style={{ marginTop: '1rem' }}>
            <a href="/auth/login" role="button" class="outline">登录后投瓶/捞瓶</a>
          </div>
        )}
      </div>

      {user && history.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3>📋 我的瓶子历史</h3>
          {history.map((item: any) => (
            <div key={item.id} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f0f0f0' }}>
              <div>
                {item.sender_user_id === user.id ? '📤 我投的' : '🎣 我捞的'}
                <span style={{
                  fontSize: '0.75rem',
                  padding: '0.15rem 0.6rem',
                  borderRadius: '999px',
                  marginLeft: '0.5rem',
                  background: item.status === 'drifting' ? '#e8f5e9' : item.status === 'picked' ? '#fff3e0' : '#e3f2fd',
                  color: item.status === 'drifting' ? '#2e7d32' : item.status === 'picked' ? '#e65100' : '#0d47a1'
                }}>
                  {item.status === 'drifting' ? '漂流中' : item.status === 'picked' ? '已捞起' : '已回复'}
                </span>
              </div>
              <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
                {item.content.length > 50 ? item.content.slice(0, 50) + '...' : item.content}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
                {new Date(item.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', fontSize: '0.85rem', color: '#666' }}>
        <p>📌 规则：每天只能投1个瓶子 · 每天只能捞1个瓶子 · 字数不超过200字</p>
      </div>
    </div>,
    {
      title: "漂流瓶 - 凉宫社区",
      user: user,
    }
  );
});

export { bottle };
