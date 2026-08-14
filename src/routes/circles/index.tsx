import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import type { Bindings, Variables } from "../../types";

const circles = new Hono<{ Bindings: Bindings; Variables: Variables }>();

circles.get("/", async (c) => {
  const db = c.env.DB;
  const token = getCookie(c, "auth_token");
  let user = null;

  if (token) {
    try {
      const payload = await verify(token, c.env.JWT_SECRET) as any;
      user = await db.prepare('SELECT id, username, avatar FROM users WHERE id = ?').bind(payload.id).first();
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
  `).all();

  const newCircles = await db.prepare(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM circle_members WHERE circle_id = c.id) as member_count,
      u.username as creator_name
    FROM circles c
    LEFT JOIN users u ON c.creator_id = u.id
    ORDER BY c.created_at DESC
    LIMIT 8
  `).all();

  return c.render(
    <div>
      <div style={{ marginTop: '1.5rem' }}>
        <h1>📁 发现圈子</h1>
        <p style={{ color: '#666' }}>找到你感兴趣的小天地，或者自己创建一个</p>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <a href="/circles/create" role="button" class="outline">➕ 创建圈子</a>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '1.5rem 0 0.75rem' }}>
        <h3>🔥 热门圈子</h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
        {hotCircles.results.map((circle: any) => (
          <a href={`/circles/${circle.id}`} key={circle.id} style={{
            textAlign: 'center',
            padding: '1.25rem 0.75rem',
            borderRadius: '12px',
            transition: 'all 0.2s',
            border: '1px solid #e8e8e8',
            background: 'white',
            textDecoration: 'none',
            color: 'inherit'
          }}>
            <div style={{ fontSize: '2.5rem' }}>{circle.icon || '📁'}</div>
            <div style={{ fontWeight: 600, margin: '0.5rem 0 0.25rem' }}>{circle.name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted-color)' }}>{circle.member_count} 人</div>
          </a>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '1.5rem 0 0.75rem' }}>
        <h3>🆕 最新圈子</h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
        {newCircles.results.map((circle: any) => (
          <a href={`/circles/${circle.id}`} key={circle.id} style={{
            textAlign: 'center',
            padding: '1.25rem 0.75rem',
            borderRadius: '12px',
            transition: 'all 0.2s',
            border: '1px solid #e8e8e8',
            background: 'white',
            textDecoration: 'none',
            color: 'inherit'
          }}>
            <div style={{ fontSize: '2.5rem' }}>{circle.icon || '📁'}</div>
            <div style={{ fontWeight: 600, margin: '0.5rem 0 0.25rem' }}>{circle.name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted