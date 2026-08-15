import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import type { Bindings, Variables } from "../../types";

const circleDetail = new Hono<{ Bindings: Bindings; Variables: Variables }>();

circleDetail.get("/:id", async (c) => {
  const id = parseInt(c.req.param('id'));
  const db = c.env.DB;
  const token = getCookie(c, "auth_token");
  let user = null;

  if (token) {
    try {
      const payload = await verify(token, c.env.JWT_SECRET) as any;
      user = await db.prepare('SELECT id, username, avatar FROM users WHERE id = ?').bind(payload.id).first();
    } catch (e) {}
  }

  const circle = await db.prepare(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM circle_members WHERE circle_id = c.id) as member_count,
      u.username as creator_name
    FROM circles c
    LEFT JOIN users u ON c.creator_id = u.id
    WHERE c.id = ?
  `).bind(id).first();

  if (!circle) {
    return c.html('<h1>圈子不存在</h1><a href="/circles">返回发现圈子</a>');
  }

  let isMember = false;
  let isCreator = false;
  if (user) {
    const member = await db.prepare(
      'SELECT role FROM circle_members WHERE circle_id = ? AND user_id = ?'
    ).bind(id, user.id).first();
    isMember = !!member;
    isCreator = circle.creator_id === user.id;
  }

  const posts = await db.prepare(`
    SELECT p.*, u.username as author_name, u.avatar as author_avatar
    FROM posts p
    LEFT JOIN users u ON p.author = u.username
    WHERE p.circle_id = ? OR p.circle_id IS NULL
    ORDER BY p.created_at DESC
    LIMIT 20
  `).bind(id).all();

  const isIconUrl = circle.icon && circle.icon.startsWith('http');

  return c.render(
    <div>
      <div style={{
        background: 'linear-gradient(135deg, #f0f7ff, #e8f0fe)',
        borderRadius: '16px',
        padding: '2rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {isIconUrl ? (
            <img 
              src={circle.icon} 
              alt={circle.name} 
              style={{ 
                width: '64px', 
                height: '64px', 
                borderRadius: '12px', 
                objectFit: 'cover',
                border: '1px solid rgba(0,0,0,0.08)',
                flexShrink: 0,
              }} 
            />
          ) : (
            <span style={{ fontSize: '3rem', flexShrink: 0 }}>{circle.icon || '📁'}</span>
          )}
          <div>
            <h1 style={{ margin: 0 }}>{circle.name}</h1>
            <p style={{ margin: '0.25rem 0', color: '#666' }}>{circle.description || '暂无描述'}</p>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#999' }}>
              👤 {circle.creator_name} · {circle.member_count} 人
            </p>
          </div>
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
          {user && !isMember && (
            <form method="POST" action={`/api/circles/${id}/join`}>
              <button type="submit" role="button" class="outline">➕ 加入圈子</button>
            </form>
          )}
          {isMember && (
            <span style={{ padding: '0.3rem 0.8rem', background: '#e8f5e9', borderRadius: '20px', color: '#2e7d32', fontSize: '0.85rem' }}>✅ 已加入</span>
          )}
          {isCreator && (
            <span style={{ padding: '0.3rem 0.8rem', background: '#fff3e0', borderRadius: '20px', color: '#e65100', fontSize: '0.85rem' }}>👑 圈主</span>
          )}
        </div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <a href={`/posts/new?circle_id=${id}`} role="button">✍️ 发帖</a>
      </div>

      <h3 style={{ marginTop: '1.5rem' }}>📄 最新帖子</h3>
      {posts.results.length === 0 ? (
        <p style={{ color: '#999', textAlign: 'center', padding: '2rem 0' }}>还没有帖子，来发第一个吧</p>
      ) : (
        posts.results.map((post: any) => (
          <div key={post.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid #f0f0f0' }}>
            <a href={`/posts/${post.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#999' }}>{post.author_name}</span>
                <span style={{ fontSize: '0.75rem', color: '#ccc' }}>·</span>
                <span style={{ fontSize: '0.75rem', color: '#ccc' }}>{new Date(post.created_at).toLocaleDateString()}</span>
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 500 }}>{post.title}</div>
              <div style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.2rem' }}>
                💬 {post.comment_count || 0} 回复
              </div>
            </a>
          </div>
        ))
      )}
    </div>,
    {
      title: `${circle.name} - 凉宫社区`,
      user: user,
    }
  );
});

export { circleDetail };