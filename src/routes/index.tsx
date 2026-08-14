import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import { PostService } from "../services/post.service";
import { UserService } from "../services/user.service";
import { TagService } from "../services/tag.service";
import type { Bindings, Variables } from "../types";
import { ExtendedJWTPayload } from "../types";

const index = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 统一的帖子列表路由，tag参数可选
index.get("/posts", async (c) => {
  const tagName = c.req.query("tag");
  const username = c.req.query("username");

  const postService = PostService.getInstance(c.env.DB);
  const userService = UserService.getInstance(c.env.DB);
  const tagService = TagService.getInstance(c.env.DB);

  // 获取所有标签及其帖子数量
  const allTags = await tagService.getAllTagsWithPostCount();

  let posts = [];
  if (username) {
    posts = await postService.getPostsByAuthor(username);
  } else if (tagName) {
    posts = await postService.getPostsByTag(tagName);
  } else {
    posts = await postService.getAllPosts();
  }

  // 获取所有帖子作者的用户信息
  const authorUsernames = [...new Set(posts.map((post) => post.author))];
  const authors = await userService.getUsersByUsernames(authorUsernames);

  // 创建用户名到头像的映射（可选）
  const usernameToAvatar: Record<string, string> = {};
  authors.forEach((author) => {
    usernameToAvatar[author.username] =
      c.env.GRAVATAR_BASE_URL + author.email_hash + "?d=identicon";
  });

  // 检查用户是否已登录
  const token = getCookie(c, "auth_token");
  let currentUser: ExtendedJWTPayload | null = null;
  if (token) {
    try {
      currentUser = (await verify(
        token,
        c.env.JWT_SECRET
      )) as ExtendedJWTPayload;
    } catch (e) {
      // Token 无效，不做任何处理
    }
  }

  const isAdmin = currentUser?.role === "admin";

  // 构建页面标题
  let pageTitle = "社区中心-凉宫数据";
  if (tagName) {
    pageTitle = `标签: ${tagName} - 凉宫社区`;
  } else if (username) {
    pageTitle = `${username} 的帖子 - 凉宫社区`;
  }

  // 格式化时间（精确到秒）
  function formatDateTime(dateStr: string): string {
    const date = new Date(dateStr + "Z");
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  // ========== 获取圈子列表 ==========
  const circles = await c.env.DB.prepare(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM circle_members WHERE circle_id = c.id) as member_count
    FROM circles c
    ORDER BY member_count DESC
    LIMIT 6
  `).all();

  // ========== 获取漂流瓶数量 ==========
  const bottleCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM bottles WHERE status = 'drifting'"
  ).first();

  return c.render(
    <div>
      {/* ===== 第一行：主导航 ===== */}
      <nav style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.75rem',
        flexWrap: 'wrap',
        gap: '0.5rem',
        borderBottom: '1px solid #e8e8e8',
        paddingBottom: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <a href="/" style={{ fontWeight: 'bold', fontSize: '1.1rem', textDecoration: 'none' }}>☁️ 凉宫社区</a>
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
            <a href="/posts" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', textDecoration: 'none', color: 'var(--primary)' }}>首页</a>
            <a href="/circles" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', textDecoration: 'none', color: '#666' }}>圈子</a>
            <a href="/bottle" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', textDecoration: 'none', color: '#666' }}>漂流瓶</a>
            <a href="/mood" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', textDecoration: 'none', color: '#666' }}>情绪</a>
            <a href="/capsule" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', textDecoration: 'none', color: '#666' }}>时光信</a>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {currentUser ? (
            <a href={`/user/${currentUser.id}`} style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', textDecoration: 'none' }}>{currentUser.username}</a>
          ) : (
            <a href="/auth/login" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', textDecoration: 'none' }}>登录</a>
          )}
        </div>
      </nav>

      {/* ===== 第二行：操作栏（标签导航 + 发帖 + 管理标签） ===== */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '0.5rem',
        flexWrap: 'wrap',
        gap: '0.3rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.15rem' }}>
          <a
            href="/posts"
            style={{
              padding: '0.2rem 0.6rem',
              fontSize: '0.8rem',
              borderRadius: '4px',
              textDecoration: 'none',
              background: !tagName && !username ? 'var(--primary)' : 'transparent',
              color: !tagName && !username ? 'white' : 'var(--primary)',
            }}
          >
            全部
          </a>
          {allTags.map((tag) => (
            <a
              key={tag.id}
              href={`/posts?tag=${tag.name}`}
              style={{
                padding: '0.2rem 0.6rem',
                fontSize: '0.75rem',
                borderRadius: '4px',
                textDecoration: 'none',
                background: tagName === tag.name ? 'var(--primary)' : 'transparent',
                color: tagName === tag.name ? 'white' : '#666',
              }}
            >
              {tag.name}({tag.post_count})
            </a>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          {isAdmin && (
            <a href="/tags" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', textDecoration: 'none', color: '#999' }}>管理标签</a>
          )}
          <a href="/posts/new" role="button" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>+ 发帖</a>
        </div>
      </div>

      {tagName && <h6 style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>标签: {tagName}</h6>}
      {username && <h6 style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>用户: {username} 的帖子</h6>}

      {/* ===== 网格缩略图列表 ===== */}
      {posts.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {posts.map((post) => {
            const postAuthor = authors.find(a => a.username === post.author);
            return (
              <li key={post.id} style={{
                border: '1px solid #e8e8e8',
                borderRadius: '12px',
                overflow: 'hidden',
                background: 'white',
                transition: 'box-shadow 0.2s'
              }}>
                <a href={`/posts/${post.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                  <div style={{ background: '#f5f5f5', overflow: 'hidden', position: 'relative' }}>
                    {post.file_url ? (
                      post.file_type?.startsWith('image/') ? (
                        <img src={post.file_url} alt={post.title} style={{ width: '100%', height: 'auto', maxHeight: '180px', objectFit: 'cover' }} loading="lazy" />
                      ) : post.file_type?.startsWith('video/') ? (
                        <video src={post.file_url} style={{ width: '100%', maxHeight: '180px' }} muted loop playsInline autoPlay />
                      ) : (
                        <div style={{ padding: '1.5rem', textAlign: 'center', color: '#999', fontSize: '0.85rem' }}>📄 文件</div>
                      )
                    ) : (
                      <div style={{ padding: '1.5rem', textAlign: 'center', color: '#ccc', fontSize: '0.85rem' }}>📝 文字</div>
                    )}
                    {post.comment_count > 0 && (
                      <span style={{
                        position: 'absolute',
                        bottom: '0.5rem',
                        right: '0.5rem',
                        background: 'rgba(0,0,0,0.6)',
                        color: 'white',
                        fontSize: '0.7rem',
                        padding: '0.1rem 0.5rem',
                        borderRadius: '12px'
                      }}>
                        💬 {post.comment_count}
                      </span>
                    )}
                  </div>
                  <div style={{ padding: '0.6rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{post.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', color: '#999' }}>
                      <span>
                        {post.author}
                        {postAuthor?.badge && (
                          <span style={{
                            background: '#4a90d9',
                            color: 'white',
                            fontSize: '0.55rem',
                            padding: '0.05rem 0.4rem',
                            borderRadius: '12px',
                            marginLeft: '0.2rem'
                          }}>
                            {postAuthor.badge}
                          </span>
                        )}
                      </span>
                      <span>{formatDateTime(post.created_at)}</span>
                    </div>
                    {post.tag && (
                      <span style={{
                        display: 'inline-block',
                        fontSize: '0.6rem',
                        background: '#f0f0f0',
                        padding: '0.05rem 0.4rem',
                        borderRadius: '4px',
                        marginTop: '0.15rem'
                      }}>
                        #{post.tag}
                      </span>
                    )}
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <p style={{ textAlign: 'center', color: '#999', padding: '3rem 0' }}>
          {tagName ? `该标签下暂无帖子` : username ? `该用户暂无帖子` : `还没有帖子，来发布第一个吧`}
        </p>
      )}
    </div>,
    {
      title: pageTitle,
      user: currentUser,
    }
  );
});

// 主页路由，重定向到/posts
index.get("/", (c) => {
  return c.redirect("/posts");
});

export { index };