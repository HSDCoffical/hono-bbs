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

  const hotCircles = await db.prepare(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM circle_members WHERE circle_id = c.id) as member_count,
      u.username as creator_name
    FROM circles c
    LEFT JOIN users u ON c.creator_id = u.id
    ORDER BY member_count DESC
    LIMIT 8
  `).all()

  const newCircles = await db.prepare(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM circle_members WHERE circle_id = c.id) as member_count,
      u.username as creator_name
    FROM circles c
    LEFT JOIN users u ON c.creator_id = u.id
    ORDER BY c.created_at DESC
    LIMIT 8
  `).all()

  const html = renderToString(
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>发现圈子 - 凉宫社区</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" />
        <style>{`
          .circle-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1rem; }
          .circle-card { text-align: center; padding: 1.25rem 0.75rem; border-radius: 12px; transition: all 0.2s; border: 1px solid #e8e8e8; background: white; }
          .circle-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
          .circle-icon { font-size: 2.5rem; }
          .circle-name { font-weight: 600; margin: 0.5rem 0 0.25rem; }
          .circle-members { font-size: 0.8rem; color: var(--muted-color); }
          .create-card { border: 2px dashed #ccc; background: transparent; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 120px; }
          .create-card:hover { border-color: var(--primary); background: var(--primary-focus); }
          .section-title { display: flex; align-items: center; justify-content: space-between; margin: 1.5rem 0 0.75rem; }
        `}</style>
      </head>
      <body>
        <main class="container" style="padding: 1rem 0;">
          <nav>
            <ul><li><a href="/" class="contrast"><strong>☁️ 凉宫社区</strong></a></li></ul>
            <ul>
              <li><a href="/">首页</a></li>
              <li><a href="/circles" role="button">圈子</a></li>
              <li><a href="/bottle">漂流瓶</a></li>
              <li><a href="/mood">情绪容器</a></li>
              <li><a href="/capsule">时光信</a></li>
              {user ? (
                <li><a href={`/user/${user.id}`}>{user.username}</a></li>
              ) : (
                <li><a href="/auth/login">登录</a></li>
              )}
            </ul>
          </nav>

          <hgroup style={{ marginTop: '1.5rem' }}>
            <h1>📁 发现圈子</h1>
            <p>找到你感兴趣的小天地，或者自己创建一个</p>
          </hgroup>

          <div style={{ marginBottom: '1.5rem' }}>
            <a href="/circles/create" role="button" class="outline">➕ 创建圈子</a>
          </div>

          <div class="section-title">
            <h3>🔥 热门圈子</h3>
          </div>
          <div class="circle-grid">
            {hotCircles.results.map((circle: any) => (
              <a href={`/circles/${circle.id}`} class="circle-card" style={{ textDecoration: 'none' }}>
                <div class="circle-icon">{circle.icon || '📁'}</div>
                <div class="circle-name">{circle.name}</div>
                <div class="circle-members">{circle.member_count} 人</div>
              </a>
            ))}
          </div>

          <div class="section-title">
            <h3>🆕 最新圈子</h3>
          </div>
          <div class="circle-grid">
            {newCircles.results.map((circle: any) => (
              <a href={`/circles/${circle.id}`} class="circle-card" style={{ textDecoration: 'none' }}>
                <div class="circle-icon">{circle.icon || '📁'}</div>
                <div class="circle-name">{circle.name}</div>
                <div class="circle-members">{circle.member_count} 人</div>
              </a>
            ))}
          </div>
        </main>
      </body>
    </html>
  )

  return c.html(html)
})

export default app