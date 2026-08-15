import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import { PostService } from "../services/post.service";
import { UserService } from "../services/user.service";
import { TagService } from "../services/tag.service";
import type { Bindings, Variables } from "../types";
import { ExtendedJWTPayload } from "../types";

const index = new Hono<{ Bindings: Bindings; Variables: Variables }>();

index.get("/posts", async (c) => {
  const tagName = c.req.query("tag");
  const username = c.req.query("username");

  const postService = PostService.getInstance(c.env.DB);
  const userService = UserService.getInstance(c.env.DB);
  const tagService = TagService.getInstance(c.env.DB);

  const allTags = await tagService.getAllTagsWithPostCount();

  let posts = [];
  if (username) {
    posts = await postService.getPostsByAuthor(username);
  } else if (tagName) {
    posts = await postService.getPostsByTag(tagName);
  } else {
    posts = await postService.getAllPosts();
  }

  const authorUsernames = [...new Set(posts.map((post) => post.author))];
  const authors = await userService.getUsersByUsernames(authorUsernames);

  const token = getCookie(c, "auth_token");
  let currentUser: ExtendedJWTPayload | null = null;
  let userAvatar: string | null = null;
  if (token) {
    try {
      currentUser = (await verify(
        token,
        c.env.JWT_SECRET
      )) as ExtendedJWTPayload;
      if (currentUser) {
        const userRecord = await c.env.DB.prepare(
          'SELECT avatar, email_hash FROM users WHERE id = ?'
        ).bind(currentUser.id).first();
        if (userRecord) {
          userAvatar = userRecord.avatar || (c.env.GRAVATAR_BASE_URL + userRecord.email_hash + "?d=identicon");
        }
      }
    } catch (e) {}
  }

  const isAdmin = currentUser?.role === "admin";

  let pageTitle = "社区中心-凉宫数据";
  if (tagName) {
    pageTitle = `标签: ${tagName} - 凉宫社区`;
  } else if (username) {
    pageTitle = `${username} 的帖子 - 凉宫社区`;
  }

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

  function getTimeGreeting(): string {
    const now = new Date();
    const chinaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
    const hour = chinaTime.getHours();
    if (hour >= 5 && hour < 9) return '早上好';
    if (hour >= 9 && hour < 12) return '上午好';
    if (hour >= 12 && hour < 14) return '中午好';
    if (hour >= 14 && hour < 18) return '下午好';
    if (hour >= 18 && hour < 21) return '傍晚好';
    return '晚上好';
  }

  // ========== 获取圈子列表 ==========
  const circles = await c.env.DB.prepare(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM circle_members WHERE circle_id = c.id) as member_count
    FROM circles c
    ORDER BY member_count DESC
    LIMIT 6
  `).all();

  // ========== 获取用户加入的圈子（包括自己创建的） ==========
  let userCircles: any[] = [];
  if (currentUser) {
    const result = await c.env.DB.prepare(`
      SELECT c.id, c.name, c.icon,
        (SELECT COUNT(*) FROM circle_members WHERE circle_id = c.id) as member_count
      FROM circles c
      JOIN circle_members cm ON c.id = cm.circle_id
      WHERE cm.user_id = ?
      ORDER BY cm.joined_at DESC
      LIMIT 6
    `).bind(currentUser.id).all();
    userCircles = result.results || [];
  }

  // ========== 获取漂流瓶数量 ==========
  const bottleCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM bottles WHERE status = 'drifting'"
  ).first();

  // ========== 获取今日情绪表达数量 ==========
  const moodCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM moods WHERE date(created_at) = date('now')"
  ).first();

  return c.render(
    <div>
      {/* ===== 顶部导航 ===== */}
      <nav style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        gap: '0.5rem',
        position: 'relative',
      }}>
        <a href="/" style={{ fontWeight: 'bold', fontSize: '1.2rem', textDecoration: 'none' }}>☁️ 凉宫社区</a>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* 首页下拉 */}
          <div className="dropdown-wrapper" style={{ position: 'relative', display: 'inline-block' }}>
            <button
              className="outline dropdown-toggle"
              style={{
                padding: '0.3rem 0.8rem',
                fontSize: '0.85rem',
                background: 'transparent',
                border: '1px solid var(--primary)',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                minWidth: '3.5rem',
                justifyContent: 'center',
              }}
              data-target="home-dropdown"
            >
              首页 <span style={{ fontSize: '0.7rem' }}>▾</span>
            </button>
            <div id="home-dropdown" className="dropdown-menu" style={{
              maxHeight: '0',
              opacity: '0',
              overflow: 'hidden',
              transition: 'maxHeight 0.3s ease, opacity 0.3s ease',
              position: 'absolute',
              top: '100%',
              left: 0,
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '6px',
              minWidth: '150px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              padding: '0',
              zIndex: 100,
              marginTop: '0.2rem',
            }}>
              <div style={{ padding: '0.3rem 0' }}>
                {isAdmin && (
                  <a href="/tags" style={{
                    display: 'block',
                    padding: '0.4rem 0.8rem',
                    textDecoration: 'none',
                    color: 'var(--primary)',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                  }}>
                    ＋ 创建标签
                  </a>
                )}
                <div style={{ borderTop: '1px solid #eee', margin: '0.2rem 0' }}></div>
                <a
                  href="/posts"
                  style={{
                    display: 'block',
                    padding: '0.4rem 0.8rem',
                    textDecoration: 'none',
                    color: !tagName && !username ? 'var(--primary)' : '#333',
                    fontSize: '0.85rem',
                    fontWeight: !tagName && !username ? 600 : 400,
                    background: !tagName && !username ? 'rgba(var(--primary-rgb), 0.08)' : 'transparent',
                  }}
                >
                  全部
                </a>
                {allTags.map((tag) => (
                  <a
                    key={tag.id}
                    href={`/posts?tag=${tag.name}`}
                    style={{
                      display: 'block',
                      padding: '0.3rem 0.8rem',
                      textDecoration: 'none',
                      color: tagName === tag.name ? 'var(--primary)' : '#333',
                      fontSize: '0.85rem',
                      fontWeight: tagName === tag.name ? 600 : 400,
                      background: tagName === tag.name ? 'rgba(var(--primary-rgb), 0.08)' : 'transparent',
                    }}
                  >
                    {tag.name}({tag.post_count})
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* 圈子下拉 */}
          <div className="dropdown-wrapper" style={{ position: 'relative', display: 'inline-block' }}>
            <button
              className="outline dropdown-toggle"
              style={{
                padding: '0.3rem 0.8rem',
                fontSize: '0.85rem',
                background: 'transparent',
                border: '1px solid var(--primary)',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                minWidth: '3.5rem',
                justifyContent: 'center',
              }}
              data-target="circles-dropdown"
            >
              圈子 <span style={{ fontSize: '0.7rem' }}>▾</span>
            </button>
            <div id="circles-dropdown" className="dropdown-menu" style={{
              maxHeight: '0',
              opacity: '0',
              overflow: 'hidden',
              transition: 'maxHeight 0.3s ease, opacity 0.3s ease',
              position: 'absolute',
              top: '100%',
              left: 0,
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '6px',
              minWidth: '180px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              padding: '0',
              zIndex: 100,
              marginTop: '0.2rem',
            }}>
              <div style={{ padding: '0.3rem 0' }}>
                <a href="/circles" style={{ display: 'block', padding: '0.4rem 0.8rem', textDecoration: 'none', color: '#333', fontSize: '0.85rem' }}>圈子首页</a>
                {currentUser ? (
                  <>
                    <div style={{ padding: '0.2rem 0.8rem', fontSize: '0.75rem', color: '#999', borderTop: '1px solid #eee' }}>我加入的圈子</div>
                    {userCircles.length > 0 ? (
                      userCircles.map((c: any) => (
                        <a key={c.id} href={`/circles/${c.id}`} style={{ display: 'block', padding: '0.3rem 0.8rem', textDecoration: 'none', color: '#333', fontSize: '0.85rem' }}>
                          {c.icon || '📁'} {c.name}
                        </a>
                      ))
                    ) : (
                      <div style={{ padding: '0.2rem 0.8rem', fontSize: '0.8rem', color: '#999' }}>暂无加入的圈子</div>
                    )}
                    <a href="/circles/create" style={{ display: 'block', padding: '0.4rem 0.8rem', textDecoration: 'none', color: 'var(--primary)', fontSize: '0.85rem', borderTop: '1px solid #eee' }}>＋ 创建圈子</a>
                  </>
                ) : (
                  <a href="/user/login" style={{ display: 'block', padding: '0.4rem 0.8rem', textDecoration: 'none', color: '#999', fontSize: '0.85rem' }}>登录后查看我的圈子</a>
                )}
              </div>
            </div>
          </div>

          {/* 情绪下拉 */}
          <div className="dropdown-wrapper" style={{ position: 'relative', display: 'inline-block' }}>
            <button
              className="outline dropdown-toggle"
              style={{
                padding: '0.3rem 0.8rem',
                fontSize: '0.85rem',
                background: 'transparent',
                border: '1px solid var(--primary)',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                minWidth: '3.5rem',
                justifyContent: 'center',
              }}
              data-target="mood-dropdown"
            >
              情绪 <span style={{ fontSize: '0.7rem' }}>▾</span>
            </button>
            <div id="mood-dropdown" className="dropdown-menu" style={{
              maxHeight: '0',
              opacity: '0',
              overflow: 'hidden',
              transition: 'maxHeight 0.3s ease, opacity 0.3s ease',
              position: 'absolute',
              top: '100%',
              left: 0,
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '6px',
              minWidth: '150px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              padding: '0',
              zIndex: 100,
              marginTop: '0.2rem',
            }}>
              <div style={{ padding: '0.3rem 0' }}>
                <a href="/bottle" style={{ display: 'block', padding: '0.4rem 0.8rem', textDecoration: 'none', color: '#333', fontSize: '0.85rem' }}>🍶 漂流瓶</a>
                <a href="/mood" style={{ display: 'block', padding: '0.4rem 0.8rem', textDecoration: 'none', color: '#333', fontSize: '0.85rem' }}>🫙 情绪容器</a>
                <a href="/capsule" style={{ display: 'block', padding: '0.4rem 0.8rem', textDecoration: 'none', color: '#333', fontSize: '0.85rem' }}>📮 时光信</a>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem', flexShrink: 0 }}>
          {currentUser ? (
            <div className="dropdown-wrapper" style={{ position: 'relative', display: 'inline-block' }}>
              <div
                className="avatar-toggle"
                style={{
                  width: '2.4rem',
                  height: '2.4rem',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: '2px solid var(--primary)',
                  flexShrink: 0,
                }}
                data-target="user-dropdown"
              >
                {userAvatar ? (
                  <img
                    src={userAvatar}
                    alt={currentUser.username}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: 'var(--primary)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    userSelect: 'none'
                  }}>
                    {currentUser.username.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div id="user-dropdown" className="dropdown-menu" style={{
                maxHeight: '0',
                opacity: '0',
                overflow: 'hidden',
                transition: 'maxHeight 0.3s ease, opacity 0.3s ease',
                position: 'absolute',
                top: '100%',
                right: 0,
                background: 'white',
                border: '1px solid #ddd',
                borderRadius: '6px',
                minWidth: '120px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                padding: '0',
                zIndex: 100,
                marginTop: '0.2rem',
              }}>
                <div style={{ padding: '0.3rem 0' }}>
                  <a href={`/profile/${currentUser.username}`} style={{ display: 'block', padding: '0.4rem 0.8rem', textDecoration: 'none', color: '#333', fontSize: '0.85rem' }}>查看资料</a>
                  <a href="/user/logout" style={{ display: 'block', padding: '0.4rem 0.8rem', textDecoration: 'none', color: '#d32f2f', fontSize: '0.85rem' }}>退出</a>
                </div>
              </div>
            </div>
          ) : (
            <a href="/user/login" role="button" class="outline" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem', borderRadius: '4px' }}>登录</a>
          )}
          <span style={{
            fontSize: '0.7rem',
            color: '#555',
            lineHeight: '1.2',
            maxWidth: '3.8rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'center',
          }}>
            {currentUser ? `${currentUser.username}，${getTimeGreeting()}` : getTimeGreeting()}
          </span>
        </div>
      </nav>

      {/* ===== 下拉菜单控制脚本 ===== */}
      <script dangerouslySetInnerHTML={{
        __html: `
          function toggleDropdown(e) {
            e.stopPropagation();
            const targetId = this.dataset.target;
            const menu = document.getElementById(targetId);
            if (!menu) return;
            document.querySelectorAll('.dropdown-menu').forEach(el => {
              if (el.id !== targetId) {
                el.style.maxHeight = '0';
                el.style.opacity = '0';
                el.style.padding = '0';
              }
            });
            const isOpen = menu.style.maxHeight && menu.style.maxHeight !== '0px';
            if (isOpen) {
              menu.style.maxHeight = '0';
              menu.style.opacity = '0';
              menu.style.padding = '0';
            } else {
              menu.style.maxHeight = '300px';
              menu.style.opacity = '1';
              menu.style.padding = '0.3rem 0';
            }
          }
          document.querySelectorAll('.dropdown-toggle, .avatar-toggle').forEach(el => {
            el.addEventListener('click', toggleDropdown);
          });
          document.addEventListener('click', function(e) {
            if (!e.target.closest('.dropdown-wrapper')) {
              document.querySelectorAll('.dropdown-menu').forEach(el => {
                el.style.maxHeight = '0';
                el.style.opacity = '0';
                el.style.padding = '0';
              });
            }
          });
          document.querySelectorAll('.dropdown-menu').forEach(el => {
            el.addEventListener('click', function(e) {
              e.stopPropagation();
            });
          });
        `
      }} />

      {/* ===== 漂流瓶 & 情绪容器快捷入口 ===== */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
      }}>
        <a href="/bottle" style={{
          flex: '1 1 200px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.6rem 1rem',
          background: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)',
          borderRadius: '12px',
          textDecoration: 'none',
          color: '#2e7d32',
          fontSize: '0.9rem',
          fontWeight: 500,
          minWidth: '150px',
        }}>
          <span>🍶 漂流瓶</span>
          <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>{bottleCount?.count || 0} 个漂着</span>
        </a>
        <a href="/mood" style={{
          flex: '1 1 200px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.6rem 1rem',
          background: 'linear-gradient(135deg, #e3f2fd, #bbdefb)',
          borderRadius: '12px',
          textDecoration: 'none',
          color: '#0d47a1',
          fontSize: '0.9rem',
          fontWeight: 500,
          minWidth: '150px',
        }}>
          <span>🫙 情绪容器</span>
          <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>{moodCount?.count || 0} 人已表达</span>
        </a>
      </div>

      {/* ===== 我加入的圈子（已登录）/ 热门圈子（未登录） ===== */}
      {currentUser ? (
        userCircles.length > 0 ? (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>📁 我加入的圈子</span>
              <a href="/circles" style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>发现更多 →</a>
            </div>
            {/* ===== 改成类似漂流瓶的卡片样式（蓝色系） ===== */}
            {userCircles.map((circle: any) => {
              const isIconUrl = circle.icon && circle.icon.startsWith('http');
              return (
                <a 
                  key={circle.id} 
                  href={`/circles/${circle.id}`} 
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.6rem 1rem',
                    marginBottom: '0.5rem',
                    background: 'linear-gradient(135deg, #f0f4ff, #dce8ff)',
                    borderRadius: '12px',
                    textDecoration: 'none',
                    color: '#1a3a6b',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    border: '1px solid rgba(66, 133, 244, 0.15)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(66, 133, 244, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isIconUrl ? (
                      <img 
                        src={circle.icon} 
                        alt={circle.name} 
                        style={{ 
                          width: '1.8rem', 
                          height: '1.8rem', 
                          borderRadius: '6px', 
                          objectFit: 'cover',
                          flexShrink: 0,
                        }} 
                      />
                    ) : (
                      <span style={{ fontSize: '1.5rem' }}>{circle.icon || '📁'}</span>
                    )}
                    {circle.name}
                  </span>
                  <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{circle.member_count} 人</span>
                </a>
              );
            })}
          </div>
        ) : (
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '12px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.9rem', color: '#999' }}>还没有加入任何圈子</span>
            <a href="/circles" style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--primary)' }}>去发现圈子 →</a>
          </div>
        )
      ) : (
        circles.results && circles.results.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>🔥 热门圈子</span>
              <a href="/circles" style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>查看更多 →</a>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {circles.results.slice(0, 4).map((circle: any) => {
                const isIconUrl = circle.icon && circle.icon.startsWith('http');
                return (
                  <a key={circle.id} href={`/circles/${circle.id}`} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.3rem 0.8rem 0.3rem 0.5rem',
                    background: '#f0f0f0',
                    borderRadius: '20px',
                    textDecoration: 'none',
                    fontSize: '0.8rem',
                    color: '#333'
                  }}>
                    {isIconUrl ? (
                      <img 
                        src={circle.icon} 
                        alt={circle.name} 
                        style={{ width: '1.2rem', height: '1.2rem', borderRadius: '4px', objectFit: 'cover' }} 
                      />
                    ) : (
                      <span>{circle.icon || '📁'}</span>
                    )}
                    {circle.name} ({circle.member_count}人)
                  </a>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* ===== 发帖按钮 ===== */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginBottom: '1rem' }}>
        <a href="/posts/new" role="button" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem', borderRadius: '4px' }}>✍️ 发帖</a>
        {tagName && <span style={{ marginLeft: '1rem', fontSize: '0.8rem', color: '#666' }}>📌 当前标签: {tagName}</span>}
        {username && !tagName && <span style={{ marginLeft: '1rem', fontSize: '0.8rem', color: '#666' }}>👤 用户: {username}</span>}
      </div>

      {/* ===== 帖子列表 ===== */}
      {posts.length > 0 ? (
        <ul class="grid grid-cols-2 gap-4 pl-0">
          {posts.map((post) => {
            const postAuthor = authors.find(a => a.username === post.author);
            return (
              <li key={post.id} class="list-none border rounded-xl overflow-hidden shadow hover:shadow-lg transition-shadow duration-200 bg-white dark:bg-gray-800">
                <a href={`/posts/${post.id}`} class="block h-full flex flex-col">
                  <div class="w-full bg-gray-100 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                    {post.file_url ? (
                      post.file_type?.startsWith('image/') ? (
                        <img
                          src={post.file_url}
                          alt={post.title}
                          class="w-full h-auto object-contain"
                          loading="lazy"
                        />
                      ) : post.file_type?.startsWith('video/') ? (
                        <video
                          src={post.file_url}
                          class="w-full h-auto"
                          muted
                          loop
                          playsInline
                          autoplay
                        />
                      ) : (
                        <div class="flex items-center justify-center h-48 text-gray-400">
                          <span class="text-sm">📄 文件</span>
                        </div>
                      )
                    ) : (
                      <div class="flex items-center justify-center h-48 text-gray-400">
                        <span class="text-sm">🖼️ 无预览</span>
                      </div>
                    )}
                    {post.comment_count !== undefined && post.comment_count > 0 && (
                      <span class="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                        💬 {post.comment_count}
                      </span>
                    )}
                  </div>
                  <div class="p-2 flex flex-col flex-grow">
                    <h3 class="text-sm font-semibold break-words" title={post.title}>
                      {post.title}
                    </h3>
                    <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-1 flex-wrap gap-x-2">
                      <span class="truncate max-w-[60%] flex items-center gap-1">
                        {post.author}
                        {postAuthor?.badge && (
                          <span class="inline-block bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full align-middle whitespace-nowrap">
                            {postAuthor.badge}
                          </span>
                        )}
                      </span>
                      <span class="whitespace-nowrap">
                        {formatDateTime(post.created_at)}
                      </span>
                    </div>
                    {post.tag && (
                      <span class="inline-block mt-1 bg-gray-200 dark:bg-gray-700 text-xs px-2 py-0.5 rounded self-start">
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
        <p class="text-center text-gray-500 py-8">
          {tagName
            ? `该标签下暂无帖子`
            : username
            ? `该用户暂无帖子`
            : `请发布您的第一个帖子`}
        </p>
      )}
    </div>,
    {
      title: pageTitle,
      user: currentUser,
    }
  );
});

index.get("/", (c) => {
  return c.redirect("/posts");
});

export { index };