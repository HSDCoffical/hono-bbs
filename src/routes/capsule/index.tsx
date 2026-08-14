import { Hono } from 'hono'
import { renderToString } from 'react-dom/server'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'
import type { Bindings } from '../../app'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const db = c.env.DB
  const token = getCookie(c, 'auth_token')
  let user = null
  let capsules: any[] = []
  let pendingCount = 0

  if (token) {
    try {
      const payload = await verify(token, c.env.JWT_SECRET) as any
      user = await db.prepare('SELECT id, username, avatar FROM users WHERE id = ?').bind(payload.id).first()

      const result = await db.prepare(`
        SELECT * FROM time_capsules
        WHERE user_id = ?
        ORDER BY created_at DESC
      `).bind(payload.id).all()
      capsules = result.results || []

      const pending = await db.prepare(`
        SELECT COUNT(*) as count FROM time_capsules
        WHERE user_id = ? AND status = 'locked' AND unlock_at <= datetime('now')
      `).bind(payload.id).first()
      pendingCount = pending?.count || 0
    } catch (e) {}
  }

  const html = renderToString(
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>时光信 - 凉宫社区</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" />
        <style>{`
          .capsule-container { max-width: 600px; margin: 0 auto; }
          .capsule-card { background: linear-gradient(135deg, #f5f0ff 0%, #f0e6ff 100%); border-radius: 16px; padding: 2rem; text-align: center; }
          .capsule-icon { font-size: 4rem; }
          .capsule-item { padding: 1rem; border-bottom: 1px solid #f0f0f0; }
          .capsule-item:last-child { border-bottom: none; }
          .status-badge { font-size: 0.75rem; padding: 0.15rem 0.6rem; border-radius: 999px; }
          .status-locked { background: #fff3e0; color: #e65100; }
          .status-unlocked { background: #e8f5e9; color: #2e7d32; }
          .status-read { background: #e3f2fd; color: #0d47a1; }
          .pending-badge { background: #ff1744; color: white; border-radius: 999px; padding: 0.1rem 0.5rem; font-size: 0.75rem; margin-left: 0.5rem; }
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
              <li><a href="/mood">情绪容器</a></li>
              <li><a href="/capsule" role="button">时光信</a></li>
              {user ? (
                <li><a href={`/user/${user.id}`}>{user.username}</a></li>
              ) : (
                <li><a href="/auth/login">登录</a></li>
              )}
            </ul>
          </nav>

          <div class="capsule-container">
            <hgroup style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <h1>📮 时光信</h1>
              <p>给未来的自己写一封信</p>
            </hgroup>

            {user ? (
              <>
                <div class="capsule-card" style={{ marginTop: '1.5rem' }}>
                  <div class="capsule-icon">✉️</div>
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: '#666' }}>
                    写一封信，设定解锁时间
                  </p>
                  {pendingCount > 0 && (
                    <div style={{ margin: '0.5rem 0' }}>
                      <span class="pending-badge">📬 {pendingCount} 封待解锁</span>
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
                      <div class="capsule-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span class={`status-badge status-${item.status}`}>
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
          </div>
        </main>
      </body>
    </html>
  )

  return c.html(html)
})

export default app