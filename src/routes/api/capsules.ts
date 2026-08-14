import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'
import type { Bindings } from '../../app'

const app = new Hono<{ Bindings: Bindings }>()

// 写时光信
app.post('/', async (c) => {
  const token = getCookie(c, 'auth_token')
  if (!token) return c.json({ error: '请先登录' }, 401)

  const payload = await verify(token, c.env.JWT_SECRET) as any
  const { content, unlock_days } = await c.req.json()
  const db = c.env.DB

  if (!content || content.trim().length < 1) {
    return c.json({ error: '内容不能为空' }, 400)
  }

  const days = parseInt(unlock_days) || 7
  if (![7, 30].includes(days) && days < 1) {
    return c.json({ error: '请选择7天或30天' }, 400)
  }

  const unlockAt = new Date()
  unlockAt.setDate(unlockAt.getDate() + days)

  const result = await db.prepare(`
    INSERT INTO time_capsules (user_id, content, unlock_at, status)
    VALUES (?, ?, ?, 'locked')
    RETURNING *
  `).bind(payload.id, content.trim(), unlockAt.toISOString()).first()

  return c.json(result)
})

// 获取用户的时光信列表
app.get('/', async (c) => {
  const token = getCookie(c, 'auth_token')
  if (!token) return c.json({ error: '请先登录' }, 401)

  const payload = await verify(token, c.env.JWT_SECRET) as any
  const db = c.env.DB

  const result = await db.prepare(`
    SELECT * FROM time_capsules
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).bind(payload.id).all()

  return c.json(result.results)
})

// 读取已解锁的时光信
app.get('/:id/read', async (c) => {
  const token = getCookie(c, 'auth_token')
  if (!token) return c.json({ error: '请先登录' }, 401)

  const payload = await verify(token, c.env.JWT_SECRET) as any
  const id = parseInt(c.req.param('id'))
  const db = c.env.DB

  const capsule = await db.prepare(
    'SELECT * FROM time_capsules WHERE id = ? AND user_id = ?'
  ).bind(id, payload.id).first()

  if (!capsule) {
    return c.json({ error: '时光信不存在' }, 404)
  }

  if (capsule.status === 'locked') {
    const unlockDate = new Date(capsule.unlock_at)
    const now = new Date()
    if (now < unlockDate) {
      return c.json({ error: '这封信还没到解锁时间', unlock_at: capsule.unlock_at }, 403)
    }
    await db.prepare(`
      UPDATE time_capsules SET status = 'unlocked' WHERE id = ?
    `).bind(id).run()
    capsule.status = 'unlocked'
  }

  if (capsule.status === 'unlocked') {
    await db.prepare(`
      UPDATE time_capsules SET status = 'read', read_at = datetime('now')
      WHERE id = ?
    `).bind(id).run()
  }

  return c.json(capsule)
})

// 获取待解锁的时光信数量
app.get('/pending-count', async (c) => {
  const token = getCookie(c, 'auth_token')
  if (!token) return c.json({ error: '请先登录' }, 401)

  const payload = await verify(token, c.env.JWT_SECRET) as any
  const db = c.env.DB

  const result = await db.prepare(`
    SELECT COUNT(*) as count FROM time_capsules
    WHERE user_id = ? AND status = 'locked' AND unlock_at <= datetime('now')
  `).bind(payload.id).first()

  return c.json({ count: result?.count || 0 })
})

export default app
