import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import type { Bindings, Variables } from "../../types";

const mood = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const MOOD_TYPES = [
  '😊 开心', '😌 平静', '😔 难过', '😤 烦躁',
  '😴 疲惫', '🤔 思考', '😄 兴奋', '😢 伤心',
  '😡 愤怒', '🥱 无聊', '😎 自信', '😰 焦虑',
  '🥰 感动', '😭 崩溃', '🤯 震惊', '😪 困倦',
  '🤗 温暖', '😨 害怕'
];

mood.get("/", async (c) => {
  const db = c.env.DB;
  const token = getCookie(c, "auth_token");
  let user = null;

  if (token) {
    try {
      const payload = await verify(token, c.env.JWT_SECRET) as any;
      user = await db.prepare('SELECT id, username FROM users WHERE id = ?').bind(payload.id).first();
    } catch (e) {}
  }

  const total = await db.prepare(
    "SELECT COUNT(*) as count FROM moods WHERE date(created_at) = date('now')"
  ).first();

  const top = await db.prepare(`
    SELECT mood_type, COUNT(*) as count
    FROM moods
    WHERE date(created_at) = date('now')
    GROUP BY mood_type
    ORDER BY count DESC
    LIMIT 1
  `).first();

  let trail: any[] = [];
  if (user) {
    const result = await db.prepare(`
      SELECT mood_type, date(created_at) as date
      FROM moods
      WHERE user_id = ? AND created_at >= datetime('now', '-7 days')
      ORDER BY created_at ASC
    `).bind(user.id).all();
    trail = result.results || [];
  }

  return c.render(
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        <h1>🫙 情绪容器</h1>
        <p style={{ color: '#666' }}>今天你的情绪是什么？</p>
      </div>

      <div style={{ background: '#f8f9fa', borderRadius: '12px', padding: '1rem', marginTop: '1rem', textAlign: 'center' }}>
        <p style={{ margin: 0 }}>
          📊 今天已有 <strong>{total?.count || 0}</strong> 人记录了情绪
          {top?.count ? ` · 最多选择：${top.mood_type} (${top.count}人)` : ''}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.75rem', margin: '1rem 0' }}>
        {MOOD_TYPES.map((moodType) => (
          <button
            class="mood-btn"
            data-mood={moodType}
            style={{
              padding: '0.75rem 0.5rem',
              border: '2px solid #e0e0e0',
              borderRadius: '12px',
              background: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'center',
              fontSize: '1.5rem'
            }}
            onclick={`
              fetch('/api/moods', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mood_type: '${moodType}' })
              }).then(r => r.json()).then(data => {
                if (data.todayCount !== undefined) {
                  document.querySelector('#today-count').textContent = data.todayCount
                }
                document.querySelectorAll('.mood-btn').forEach(el => el.style.borderColor = '#e0e0e0')
                this.style.borderColor = '#4a90d9'
                this.style.background = '#e8f0fe'
              })
            `}
          >
            <span style={{ display: 'block', fontSize: '0.6rem', color: '#666', marginTop: '0.15rem' }}>
              {moodType}
            </span>
          </button>
        ))}
      </div>

      {user && trail.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3>📈 你的情绪轨迹 (7天)</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
            {trail.map((item: any, index: number) => {
              const colors = ['#e3f2fd', '#e8f5e9', '#fff3e0', '#fce4ec', '#f3e5f5', '#e0f7fa', '#fff8e1'];
              return (
                <span key={index} style={{ padding: '0.2rem 0.6rem', margin: '0.15rem', borderRadius: '12px', fontSize: '0.8rem', background: colors[index % 7] }}>
                  {item.date.slice(5)}: {item.mood_type}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', fontSize: '0.85rem', color: '#666' }}>
        <p>📌 点击情绪记录 · 看看有多少人和你一样</p>
      </div>
    </div>,
    {
      title: "情绪容器 - 凉宫社区",
      user: user,
    }
  );
});

export { mood };
