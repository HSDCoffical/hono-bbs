import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'
import type { Bindings } from '../../app'

const app = new Hono<{ Bindings: Bindings }>()

// 获取漂流瓶数量
app.get('/count', async (c) => {
  const db = c.env.DB
  const result = await db.prepare(
    "SELECT COUNT(*) as count FROM bottles WHERE status = 'drifting'"
  ).first()
  return c.json({ count: result?.count || 0 })
})

// 投瓶
app.post('/', async (c) => {
  const token = getCookie(c, 'auth_token')
  if (!token) return c.json({ error: '请先登录' }, 401)

  const payload = await verify(token, c.env.JWT_SECRET) as any
  const { content, is_anonymous } = await c.req.json()
  const db = c.env.DB

  if (!content || content.trim().length < 1) {
    return c.json({ error: '内容不能为空' }, 400)
  }
  if (content.length > 200) {
    return c.json({ error: '内容不能超过200字' }, 400)
  }

  const todayCount = await db.prepare(`
    SELECT COUNT(*) as count FROM bottles
    WHERE sender_user_id = ? AND date(created_at) = date('now')
  `).bind(payload.id).first()

  if ((todayCount?.count || 0) >= 1) {
    return c.json({ error: '每天只能投1个瓶子' }, 429)
  }

  const result = await db.prepare(`
    INSERT INTO bottles (sender_user_id, content, is_anonymous, status)
    VALUES (?, ?, ?, 'drifting')
    RETURNING *
  `).bind(payload.id, content.trim(), is_anonymous || false).first()

  return c.json(result)
})

// 捞瓶子
app.post('/pick', async (c) => {
  const token = getCookie(c, 'auth_token')
  if (!token) return c.json({ error: '请先登录' }, 401)

  const payload = await verify(token, c.env.JWT_SECRET) as any
  const db = c.env.DB

  const todayCount = await db.prepare(`
    SELECT COUNT(*) as count FROM bottles
    WHERE picked_by_user_id = ? AND date(picked_at) = date('now')
  `).bind(payload.id).first()

  if ((todayCount?.count || 0) >= 1) {
    return c.json({ error: '每天只能捞1个瓶子' }, 429)
  }

  const bottle = await db.prepare(`
    SELECT * FROM bottles
    WHERE status = 'drifting' AND sender_user_id != ?
    ORDER BY RANDOM()
    LIMIT 1
  `).bind(payload.id).first()

  if (!bottle) {
    return c.json({ error: '海面没有瓶子了，试试投一个吧' }, 404)
  }

  await db.prepare(`
    UPDATE bottles
    SET status = 'picked', picked_by_user_id = ?, picked_at = datetime('now')
    WHERE id = ?
  `).bind(payload.id, bottle.id).run()

  return c.json(bottle)
})

// 回复瓶子
app.post('/:id/reply', async (c) => {
  const token = getCookie(c, 'auth_token')
  if (!token) return c.json({ error: '请先登录' }, 401)

  const payload = await verify(token, c.env.JWT_SECRET) as any
  const bottleId = parseInt(c.req.param('id'))
  const { reply_content } = await c.req.json()
  const db = c.env.DB

  if (!reply_content || reply_content.trim().length < 1) {
    return c.json({ error: '回复内容不能为空' }, 400)
  }
  if (reply_content.length > 200) {
    return c.json({ error: '回复不能超过200字' }, 400)
  }

  const bottle = await db.prepare(
    'SELECT * FROM bottles WHERE id = ? AND status = ?'
  ).bind(bottleId, 'picked').first()

  if (!bottle) {
    return c.json({ error: '瓶子不存在或已被回复' }, 404)
  }

  if (bottle.picked_by_user_id !== payload.id) {
    return c.json({ error: '这不是你捞的瓶子' }, 403)
  }

  await db.prepare(`
    UPDATE bottles
    SET status = 'replied', reply_content = ?, replied_at = datetime('now')
    WHERE id = ?
  `).bind(reply_content.trim(), bottleId).run()

  const updated = await db.prepare('SELECT * FROM bottles WHERE id = ?').bind(bottleId).first()
  return c.json(updated)
})

export default app