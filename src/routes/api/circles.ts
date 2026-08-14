import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'
import type { Bindings } from '../../app'

const app = new Hono<{ Bindings: Bindings }>()

// 获取所有圈子
app.get('/', async (c) => {
  const db = c.env.DB
  const result = await db.prepare(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM circle_members WHERE circle_id = c.id) as member_count
    FROM circles c
    ORDER BY member_count DESC, created_at DESC
  `).all()
  return c.json(result.results)
})

// 获取热门圈子（推荐）
app.get('/hot', async (c) => {
  const db = c.env.DB
  const result = await db.prepare(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM circle_members WHERE circle_id = c.id) as member_count
    FROM circles c
    ORDER BY member_count DESC
    LIMIT 8
  `).all()
  return c.json(result.results)
})

// 获取单个圈子详情
app.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const db = c.env.DB
  
  const circle = await db.prepare(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM circle_members WHERE circle_id = c.id) as member_count,
      u.username as creator_name
    FROM circles c
    LEFT JOIN users u ON c.creator_id = u.id
    WHERE c.id = ?
  `).bind(id).first()
  
  if (!circle) {
    return c.json({ error: '圈子不存在' }, 404)
  }
  
  return c.json(circle)
})

// 创建圈子
app.post('/', async (c) => {
  const token = getCookie(c, 'auth_token')
  if (!token) return c.json({ error: '请先登录' }, 401)
  
  const payload = await verify(token, c.env.JWT_SECRET) as any
  const { name, description, icon } = await c.req.json()
  const db = c.env.DB
  
  if (!name || name.length < 2) {
    return c.json({ error: '圈子名称至少2个字符' }, 400)
  }
  if (name.length > 30) {
    return c.json({ error: '圈子名称不能超过30个字符' }, 400)
  }
  
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  
  const existing = await db.prepare('SELECT id FROM circles WHERE slug = ?').bind(slug).first()
  if (existing) {
    return c.json({ error: '圈子名称已存在，请换一个' }, 400)
  }
  
  const result = await db.prepare(`
    INSERT INTO circles (name, slug, description, icon, creator_id)
    VALUES (?, ?, ?, ?, ?)
    RETURNING *
  `).bind(name, slug, description || '', icon || '📁', payload.id).first()
  
  await db.prepare(`
    INSERT INTO circle_members (circle_id, user_id, role)
    VALUES (?, ?, 'admin')
  `).bind(result.id, payload.id).run()
  
  return c.json(result)
})

// 加入圈子
app.post('/:id/join', async (c) => {
  const token = getCookie(c, 'auth_token')
  if (!token) return c.json({ error: '请先登录' }, 401)
  
  const payload = await verify(token, c.env.JWT_SECRET) as any
  const circleId = parseInt(c.req.param('id'))
  const db = c.env.DB
  
  const circle = await db.prepare('SELECT id FROM circles WHERE id = ?').bind(circleId).first()
  if (!circle) {
    return c.json({ error: '圈子不存在' }, 404)
  }
  
  const existing = await db.prepare(
    'SELECT id FROM circle_members WHERE circle_id = ? AND user_id = ?'
  ).bind(circleId, payload.id).first()
  
  if (existing) {
    return c.json({ error: '已加入该圈子' }, 400)
  }
  
  await db.prepare(`
    INSERT INTO circle_members (circle_id, user_id)
    VALUES (?, ?)
  `).bind(circleId, payload.id).run()
  
  return c.json({ success: true })
})

// 退出圈子
app.post('/:id/leave', async (c) => {
  const token = getCookie(c, 'auth_token')
  if (!token) return c.json({ error: '请先登录' }, 401)
  
  const payload = await verify(token, c.env.JWT_SECRET) as any
  const circleId = parseInt(c.req.param('id'))
  const db = c.env.DB
  
  const circle = await db.prepare(
    'SELECT creator_id FROM circles WHERE id = ?'
  ).bind(circleId).first()
  
  if (circle?.creator_id === payload.id) {
    return c.json({ error: '圈主不能退出圈子' }, 400)
  }
  
  await db.prepare(
    'DELETE FROM circle_members WHERE circle_id = ? AND user_id = ?'
  ).bind(circleId, payload.id).run()
  
  return c.json({ success: true })
})

export default app