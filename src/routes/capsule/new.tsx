import { Hono } from 'hono'
import { renderToString } from 'react-dom/server'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'
import type { Bindings } from '../../app'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const token = getCookie(c, 'auth_token')
  if (!token) {
    return c.redirect('/auth/login')
  }

  const payload = await verify(token, c.env.JWT_SECRET) as any
  const db = c.env.DB
  const user = await db.prepare('SELECT id, username FROM users WHERE id = ?').bind(payload.id).first()

  const html = renderToString(
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>写时光信 - 凉宫社区</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" />
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
              <li><a href={`/user/${user.id}`}>{user.username}</a></li>
            </ul>
          </nav>

          <div style={{ maxWidth: '500px', margin: '2rem auto' }}>
            <h1>✍️ 写时光信</h1>
            <p style={{ color: '#666' }}>写一段话给未来的自己</p>

            <form method="POST" action="/capsule/new">
              <div>
                <label htmlFor="content">内容</label>
                <textarea id="content" name="content" rows={6} required style={{ resize: 'vertical' }}></textarea>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <label htmlFor="unlock_days">解锁时间</label>
                <select id="unlock_days" name="unlock_days">
                  <option value="7">7天后</option>
                  <option value="30">30天后</option>
                </select>
              </div>
              <button type="submit" role="button" style={{ marginTop: '1rem' }}>📨 寄出这封信</button>
            </form>
          </div>
        </main>
      </body>
    </html>
  )

  return c.html(html)
})

app.post('/', async (c) => {
  const token = getCookie(c, 'auth_token')
  if (!token) {
    return c.json({ error: '请先登录' }, 401)
  }

  const payload = await verify(token, c.env.JWT_SECRET) as any
  const db = c.env.DB
  const formData = await c.req.formData()
  const content = formData.get('content') as string
  const unlock_days = parseInt(formData.get('unlock_days') as string) || 7

  if (!content || content.trim().length < 1) {
    return c.html('<p style="color:red;">内容不能为空</p><a href="/capsule/new">返回</a>')
  }

  const unlockAt = new Date()
  unlockAt.setDate(unlockAt.getDate() + unlock_days)

  await db.prepare(`
    INSERT INTO time_capsules (user_id, content, unlock_at, status)
    VALUES (?, ?, ?, 'locked')
  `).bind(payload.id, content.trim(), unlockAt.toISOString()).run()

  return c.redirect('/capsule')
})

export default app