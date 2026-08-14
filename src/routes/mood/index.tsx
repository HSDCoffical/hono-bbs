import { Hono } from 'hono'
import { renderToString } from 'react-dom/server'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'
import type { Bindings } from '../../app'
import { MOOD_TYPES } from '../api/moods'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const db = c.env.DB
  const token = getCookie(c, 'auth_token')
  let user = null

  if (token) {
    try {
      const payload = await verify(token, c.env.JWT_SECRET) as any
      user = await db.prepare('SELECT id, username FROM users WHERE id = ?').bind(payload.id).first()
    } catch (e) {}
  }

  // 获取今日统计
  const total = await db.prepare(
    "SELECT COUNT(*) as count FROM moods WHERE date(created_at) = date('now')"
  ).first()

  const top = await db.prepare(`
    SELECT mood_type, COUNT(*) as count
    FROM moods
    WHERE date(created_at) = date('now')
    GROUP BY mood_type
    ORDER BY count DESC
    LIMIT 1
  `).first()

  // 获取用户7天轨迹
  let trail: any[] = []
  if (user) {
    const result = await db.prepare(`
      SELECT mood_type, date(created_at) as date
      FROM moods
      WHERE user_id = ? AND created_at >= datetime('now', '-7 days')
      ORDER BY created_at ASC
    `).bind(user.id).all()
    trail = result.results || []
  }

  const html = renderToString(
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>情绪容器 - 凉宫社区</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" />
        <style>{`
          .mood-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 0.75rem; margin: 1rem 0; }
          .mood-btn { padding: 0.75rem 0.5rem; border: 2px solid #e0e0e0; border-radius: 12px; background: white; cursor: pointer; transition: all 0.2s; text-align: center; font-size: 1.5rem; }
          .mood-btn:hover { border-color: #4a90d9; transform: scale(1.05); }
          .mood-btn.selected { border-color: #4a90d9; background: #e8f0fe; }
          .mood-label { display: block; font-size: 0.6rem; color: #666; margin-top: 0.15rem; }
          .trail-item { display: inline-block; padding: 0.2rem 0.6rem; margin: 0.15rem; border-radius: 12px; font-size: 0.8rem; }
          .trail-item:nth-child(1) { background: #e3f2fd; }
          .trail-item:nth-child(2) { background: #e8f5e9; }
          .trail-item:nth-child(3) { background: #fff3e0; }
          .trail-item:nth-child(4) { background: #fce4ec; }
          .trail-item:nth-child(5) { background: #f3e5f5; }
          .trail-item:nth-child(6) { background: #e0f7fa; }
          .trail-item:nth-child(7) { background: #fff8e1; }
        `}</style>
      </head>
      <body>
        <main class="container" style="padding: 1rem 0;">
          <nav>
            <ul><li><a href="/" class="contrast"><strong>☁️ 凉宫社区</strong></a></li></ul>
            <ul>
              <li><a href="/">首页</a></li>
              <li><a href="/circles">圈子</a></li>
              <li><a href="/bottle">漂流瓶</a></li>
              <li><a href="/mood" role="button">情绪容器</a></li>
              <li><a href="/capsule">时光信</a></li>
              {user ? (
                <li><a href={`/user/${user.id}`}>{user.username}</a></li>
              ) : (
                <li><a href="/auth/login">登录</a></li>
              )}
            </ul>
          </nav>

          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <hgroup style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <h1>🫙 情绪容器</h1>
              <p>今天你的情绪是什么？</p>
            </hgroup>

            <div style={{ background: '#f8f9fa', borderRadius: '12px', padding: '1rem', marginTop: '1rem', textAlign: 'center' }}>
              <p style={{ margin: 0 }}>
                📊 今天已有 <strong>{total?.count || 0}</strong> 人记录了情绪
                {top?.count ? ` · 最多选择：${top.mood_type} (${top.count}人)` : ''}
              </p>
            </div>

            <div class="mood-grid">
              {MOOD_TYPES.map((mood) => (
                <button
                  class="mood-btn"
                  data-mood={mood}
                  onclick={`
                    fetch('/api/moods', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ mood_type: '${mood}' })
                    }).then(r => r.json()).then(data => {
                      if (data.todayCount !== undefined) {
                        document.querySelector('#today-count').textContent = data.todayCount
                      }
                      document.querySelectorAll('.mood-btn').forEach(el => el.classList.remove('selected'))
                      this.classList.add('selected')
                    })
                  `}
                >
                  {mood}
                </button>
              ))}
            </div>

            {user && trail.length > 0 && (
              <div style={{ marginTop: '2rem' }}>
                <h3>📈 你的情绪轨迹 (7天)</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                  {trail.map((item) => (
                    <span class="trail-item">{item.date.slice(5)}: {item.mood_type}</span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: '2rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', fontSize: '0.85rem', color: '#666' }}>
              <p>📌 点击情绪记录 · 看看有多少人和你一样</p>
            </div>
          </div>
        </main>
      </body>
    </html>
  )

  return c.html(html)
})

export default app