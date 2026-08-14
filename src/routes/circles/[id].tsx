import { Hono } from 'hono'
import { renderToString } from 'react-dom/server'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'
import type { Bindings } from '../../app'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const db = c.env.DB
  const token = getCookie(c, 'auth_token')
  let user = null

  if (token) {
    try {
      const payload = await verify(token, c.env.JWT_SECRET) as any
      user = await db.prepare('SELECT id, username, avatar FROM users WHERE id = ?').bind(payload.id).first()
    } catch (e) {}
  }

  const circle = await db.prepare(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM circle_members WHERE circle_id = c.id) as member_count,
      u.username as creator_name
    FROM circles c
    LEFT JOIN users u ON c.creator_id = u.id
    WHERE c.id = ?
  `).bind(id).first()

  if (!circle) {
    return c.html('<h1>圈子不存在</h1><a href="/circles">返回发现圈子</a>')
  }

  // 检查用户是否已加入
  let isMember = false
  let isCreator = false
  if (user) {
    const member = await db.prepare(
      'SELECT role FROM circle_members WHERE circle