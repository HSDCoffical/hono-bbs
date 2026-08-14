import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'
import type { Bindings } from '../../app'

const app = new Hono<{ Bindings: Bindings }>()

// 预设情绪列表
export const MOOD_TYPES = [
  '😊 开心', '😌 平静', '😔 难过', '😤 烦躁',
  '😴 疲惫', '🤔 思考', '😄 兴奋', '😢 伤心',
  '😡 愤怒', '🥱 无聊', '😎 自信', '😰 焦虑',
  '🥰 感动', '😭 崩溃', '🤯 震惊', '😪 困倦',
  '🤗 温暖', '😨 害怕'
]

// 获取今日情绪统计
app.get('/today', async (c) => {
  const db = c.env.DB

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

  return c.json({
    count: total?.count || 0,
    top: top?.mood_type || null,
    topCount: top?.count || 0
  })
})

// 记录情绪
app.post('/', async (c) => {
  const { mood_type, session_id } = await c.req.json()
  const db = c.env.DB

  if (!MOOD_TYPES.includes(mood_type)) {
    return c.json({ error: '无效的情绪类型' }, 400)
  }

  let userId = null
  const token = getCookie(c, 'auth_token')
  if (token) {
    try {
      const payload = await verify(token, c.env.JWT_SECRET) as any
      userId = payload.id
    } catch (e) {}
  }

  const result = await db.prepare(`
    INSERT INTO moods (user_id, session_id, mood_type)
    VALUES (?, ?, ?)
    RETURNING *
  `).bind(userId, userId ? null : (session_id || crypto.randomUUID()), mood_type).first()

  const total = await db.prepare(
    "SELECT COUNT(*) as count FROM moods WHERE date(created_at) = date('now')"
  ).first()

  return c.json({
    mood: result,
    todayCount: total?.count || 0
  })
})

// 获取用户情绪轨迹（7天）
app.get('/trail', async (c) => {
  const token = getCookie(c, 'auth_token')
  if (!token) return c.json({ error: '请先登录' }, 401)

  const payload = await verify(token, c.env.JWT_SECRET) as any
  const db = c.env.DB

  const result = await db.prepare(`
    SELECT mood_type, date(created_at) as date
    FROM moods
    WHERE user_id = ? AND created_at >= datetime('now', '-7 days')
    ORDER BY created_at ASC
  `).bind(payload.id).all()

  return c.json(result.results)
})

export default app