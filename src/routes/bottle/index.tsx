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

  if (token) {
    try {
      const payload = await verify(token, c.env.JWT_SECRET) as any
      user = await db.prepare('SELECT id, username, avatar FROM users WHERE id = ?').bind(payload.id).first()
    } catch (e) {}
  }

  // 获取漂流瓶数量
  const bottleCount = await db.prepare(
    "SELECT COUNT(*) as count FROM bottles WHERE status = 'drifting'"
  ).first()

  // 获取用户历史
  let history = []
  if (user) {
    history = await db.prepare(`
      SELECT * FROM bottles
      WHERE sender_user_id = ? OR picked_by_user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).bind(user.id, user.id).all()
    history = history.results || []
  }

  const html = renderToString(
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>漂流瓶 - 凉宫社区</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" />
        <style>{`
          .bottle-container { max-width: 600px; margin: 0 auto; }
          .bottle-card { background: linear-gradient(135deg, #f0f7ff 0%, #e8f4f8 100%); border-radius: 16px; padding: 2rem; text-align: center; }
          .bottle-icon { font-size: 4rem; }
          .action-buttons { display: flex; gap: 1rem; justify-content: center; margin-top: 1.5rem; flex-wrap: wrap; }
          .history-item { padding: 0.75rem 1rem; border-bottom: 1px solid #f0f0f0; }
          .history-item:last-child { border-bottom: none; }
          .status-badge { font-size: 0.75rem; padding: 0.15rem 0.6rem; border-radius: 999px; }
          .status-drifting { background: #e8f5e9; color: #2e7d32; }
          .status-picked { background: #fff3e0; color: #e65100; }
          .status-replied { background: #e3f2fd; color: #0d47a1; }
        `}</style>
      </head>
      <body>
        <main class="container" style="padding: 1rem 0;">
          <nav>
            <ul><li><a href="/" class="contrast"><strong>☁️ 凉宫社区</strong></a></li></ul>
            <ul>
              <li><a href="/">首页</a></li>
              <li><a href="/circles">圈子</a></li>
              <li><a href="/bottle" role="button">漂流瓶</a></li>
              <li><a href="/mood">情绪容器</a></li>
              <li><a href="/capsule">时光信</a></li>
              {user ? (
                <li><a href={`/user/${user.id}`}>{user.username}</a></li>
              ) : (
                <li><a href="/auth/login">登录</a></li>
              )}
            </ul>
          </nav>

          <div class="bottle-container">
            <hgroup style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <h1>🍶 漂流瓶</h1>
              <p>把心事装进瓶子，漂向未知的远方</p>
            </hgroup>

            <div class="bottle-card" style={{ marginTop: '1.5rem' }}>
              <div class="bottle-icon">🍾</div>
              <p style={{ margin: '0.5rem 0 0' }}>
                {bottleCount?.count > 0
                  ? `🌊 有 ${bottleCount.count} 个瓶子在海上漂着`
                  : '🌊 海面很平静，投一个瓶子吧'}
              </p>

              {user ? (
                <div class="action-buttons">
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
                  <div class="history-item">
                    <div>
                      {item.sender_user_id === user.id ? '📤 我投的' : '🎣 我捞的'}
                      <span class={`status-badge status-${item.status}`}>
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
          </div>
        </main>
      </body>
    </html>
  )

  return c.html(html)
})

export default app