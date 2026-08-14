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

  // 检查今日是否已捞
  const todayCount = await db.prepare(`
    SELECT COUNT(*) as count FROM bottles
    WHERE picked_by_user_id = ? AND date(picked_at) = date('now')
  `).bind(payload.id).first()

  const alreadyPicked = (todayCount?.count || 0) >= 1

  // 随机捞一个瓶子
  let bottle = null
  if (!alreadyPicked) {
    bottle = await db.prepare(`
      SELECT * FROM bottles
      WHERE status = 'drifting' AND sender_user_id != ?
      ORDER BY RANDOM()
      LIMIT 1
    `).bind(payload.id).first()
  }

  const html = renderToString(
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>捞瓶子 - 凉宫社区</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" />
        <style>{`
          .bottle-card { background: linear-gradient(135deg, #f0f7ff 0%, #e8f4f8 100%); border-radius: 16px; padding: 2rem; text-align: center; }
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
              <li><a href={`/user/${user.id}`}>{user.username}</a></li>
            </ul>
          </nav>

          <div style={{ maxWidth: '500px', margin: '2rem auto' }}>
            <h1>🎣 捞一个瓶子</h1>

            {alreadyPicked ? (
              <div style={{ padding: '2rem', background: '#fff3e0', borderRadius: '12px', textAlign: 'center' }}>
                <p style={{ fontSize: '1.2rem' }}>🎣 你今天已经捞过瓶子了</p>
                <p style={{ color: '#666' }}>明天再来吧</p>
                <a href="/bottle" role="button" class="outline" style={{ marginTop: '1rem' }}>返回漂流瓶</a>
              </div>
            ) : !bottle ? (
              <div style={{ padding: '2rem', background: '#f0f0f0', borderRadius: '12px', textAlign: 'center' }}>
                <p style={{ fontSize: '1.2rem' }}>🌊 海面没有瓶子了</p>
                <p style={{ color: '#666' }}>试试投一个吧</p>
                <a href="/bottle/send" role="button" style={{ marginTop: '1rem' }}>📤 投瓶子</a>
              </div>
            ) : (
              <div class="bottle-card">
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🍾</div>
                <p style={{ fontStyle: 'italic', fontSize: '1.1rem', color: '#333' }}>
                  {bottle.is_anonymous ? '[匿名]' : ''}
                </p>
                <p style={{ fontSize: '1.1rem', color: '#333' }}>“{bottle.content}”</p>
                <p style={{ fontSize: '0.85rem', color: '#999', marginTop: '1rem' }}>
                  来自 {bottle.is_anonymous ? '匿名用户' : '一个陌生人'}
                </p>
                <div style={{ marginTop: '1.5rem' }}>
                  <form method="POST" action={`/bottle/pick/${bottle.id}/reply`} style={{ display: 'inline' }}>
                    <input type="text" name="reply_content" placeholder="写一句回复..." maxLength={200} required style={{ width: '100%', maxWidth: '300px', marginBottom: '0.5rem' }} />
                    <button type="submit" role="button">💬 回复</button>
                  </form>
                  <a href="/bottle" class="outline" style={{ marginLeft: '0.5rem' }}>放回海里</a>
                </div>
              </div>
            )}
          </div>
        </main>
      </body>
    </html>
  )

  return c.html(html)
})

app.post('/:id/reply', async (c) => {
  const token = getCookie(c, 'auth_token')
  if (!token) {
    return c.json({ error: '请先登录' }, 401)
  }

  const payload = await verify(token, c.env.JWT_SECRET) as any
  const bottleId = parseInt(c.req.param('id'))
  const db = c.env.DB
  const formData = await c.req.formData()
  const reply_content = formData.get('reply_content') as string

  if (!reply_content || reply_content.trim().length < 1) {
    return c.html('<p style="color:red;">回复不能为空</p><a href="/bottle/pick">返回</a>')
  }
  if (reply_content.length > 200) {
    return c.html('<p style="color:red;">回复不能超过200字</p><a href="/bottle/pick">返回</a>')
  }

  const bottle = await db.prepare(
    'SELECT * FROM bottles WHERE id = ? AND status = ?'
  ).bind(bottleId, 'picked').first()

  if (!bottle) {
    return c.html('<p style="color:red;">瓶子已被回复或不存在</p><a href="/bottle/pick">返回</a>')
  }

  if (bottle.picked_by_user_id !== payload.id) {
    return c.html('<p style="color:red;">这不是你捞的瓶子</p><a href="/bottle/pick">返回</a>')
  }

  await db.prepare(`
    UPDATE bottles
    SET status = 'replied', reply_content = ?, replied_at = datetime('now')
    WHERE id = ?
  `).bind(reply_content.trim(), bottleId).run()

  return c.redirect('/bottle')
})

export default app