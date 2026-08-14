import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import type { Bindings, Variables } from "../../types";

const capsule = new Hono<{ Bindings: Bindings; Variables: Variables }>();

capsule.get("/", async (c) => {
  const db = c.env.DB;
  const token = getCookie(c, "auth_token");
  let user = null;
  let capsules: any[] = [];
  let pendingCount = 0;

  if (token) {
    try {
      const payload = await verify(token, c.env.JWT_SECRET) as any;
      user = await db.prepare('SELECT id, username, avatar FROM users WHERE id = ?').bind(payload.id).first();

      const result = await db.prepare(`
        SELECT * FROM time_capsules
        WHERE user_id = ?
        ORDER BY created_at DESC
      `).bind(payload.id).all();
      capsules = result.results || [];

      const pending = await db.prepare(`
        SELECT COUNT(*) as count FROM time_capsules
        WHERE user_id = ? AND status = 'locked' AND unlock_at <= datetime('now')
      `).bind(payload.id).first();
      pendingCount = pending?.count || 0;
    } catch (e) {}
  }

  return c.render(
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        <h1>📮 时光信</h1>
        <p style={{ color: '#666' }}>给未来的自己写一封信</p>
      </div>

      {user ? (
        <>
          <div style={{ background: 'linear-gradient(135deg, #f5f0ff 0%, #f0e6ff 100%)', borderRadius: '16px', padding: '2rem', textAlign: 'center', marginTop: '1.5rem' }}>
            <div style={{ fontSize: '4rem' }}>✉️</div>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: '#666' }}>
              写一封信，设定解锁时间
            </p>
            {pendingCount > 0 && (
              <div style={{ margin: '0.5rem 0' }}>
                <span style={{ background: '#ff1744', color: 'white', borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                  📬 {pendingCount} 封待解锁
                </span>
              </div>
            )}
            <div style={{ marginTop: '1rem' }}>
              <a href="/capsule/new" role="button">✍️ 写时光信</a>
            </div>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <h3>📋 我的时光信</h3>
            {capsules.length === 0 ? (
              <p style={{ color: '#999', textAlign: 'center', padding: '2rem 0' }}>还没有写过时光信</p>
            ) : (
              capsules.map((item: any) => (
                <div key={item.id} style={{ padding: '1rem', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '0.15rem 0.6rem',
                      borderRadius: '999px',
                      background: item.status === 'locked' ? '#fff3e0' : item.status === 'unlocked' ? '#e8f5e9' : '#e3f2fd',
                      color: item.status === 'locked' ? '#e65100' : item.status === 'unlocked' ? '#2e7d32' : '#0d47a1'
                    }}>
                      {item.status === 'locked' ? '🔒 未解锁' : item.status === 'unlocked' ? '🔓 待阅读' : '📖 已读'}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: '#999' }}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
                    {item.content.length > 60 ? item.content.slice(0, 60) + '...' : item.content}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '0.25rem' }}>
                    {item.status === 'locked'
                      ? `📅 ${new Date(item.unlock_at).toLocaleDateString()} 解锁`
                      : item.status === 'unlocked'
                      ? '🔔 点击阅读'
                      : `📖 ${new Date(item.read_at).toLocaleDateString()} 已读`}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <p>登录后写一封给未来的信</p>
          <a href="/auth/login" role="button" class="outline">登录</a>
        </div>
      )}

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', fontSize: '0.85rem', color: '#666' }}>
        <p>📌 规则：可选择7天或30天后解锁 · 写信内容会完整保存</p>
      </div>
    </div>,
    {
      title: "时光信 - 凉宫社区",
      user: user,
    }
  );
});

export { capsule };