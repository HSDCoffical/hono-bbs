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
  const searchQuery = c.req.query("search");

  const postService = PostService.getInstance(c.env.DB);
  const userService = UserService.getInstance(c.env.DB);
  const tagService = TagService.getInstance(c.env.DB);

  const allTags = await tagService.getAllTagsWithPostCount();

  let posts = [];
  if (username) {
    posts = await postService.getPostsByAuthor(username);
  } else if (tagName) {
    posts = await postService.getPostsByTag(tagName);
  } else if (searchQuery) {
    try {
      const circleMatch = searchQuery.match(/^#([^\s]+)\s+(.+)/);
      if (circleMatch) {
        const circleName = circleMatch[1];
        const keyword = circleMatch[2];
        posts = await postService.searchPostsInCircle(keyword, circleName);
      } else {
        posts = await postService.searchPosts(searchQuery);
      }
    } catch (e) {
      posts = [];
    }
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
  } else if (searchQuery) {
    pageTitle = `搜索: ${searchQuery} - 凉宫社区`;
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

  const circles = await c.env.DB.prepare(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM circle_members WHERE circle_id = c.id) as member_count
    FROM circles c
    ORDER BY member_count DESC
    LIMIT 6
  `).all();

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

  const bottleCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM bottles WHERE status = 'drifting'"
  ).first();

  const moodCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM moods WHERE date(created_at) = date('now')"
  ).first();

  return c.render(
    <div style={{
      willChange: 'transform',
      WebkitOverflowScrolling: 'touch',
      overflowY: 'auto',
      contain: 'layout style paint',
    }}>
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

        {/* ===== 修改点：marginLeft: '0.8rem' 让三个菜单整体右移 ===== */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginLeft: '0.8rem' }}>
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
                    color: !tagName && !username && !searchQuery ? 'var(--primary)' : '#333',
                    fontSize: '0.85rem',
                    fontWeight: !tagName && !username && !searchQuery ? 600 : 400,
                    background: !tagName && !username && !searchQuery ? 'rgba(var(--primary-rgb), 0.08)' : 'transparent',
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
                      userCircles.map((c: any) => {
                        const isIconUrl = c.icon && c.icon.startsWith('http');
                        return (
                          <a key={c.id} href={`/circles/${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.8rem', textDecoration: 'none', color: '#333', fontSize: '0.85rem' }}>
                            {isIconUrl ? (
                              <img 
                                src={c.icon} 
                                alt={c.name} 
                                style={{ width: '1.2rem', height: '1.2rem', borderRadius: '4px', objectFit: 'cover' }} 
                              />
                            ) : (
                              <span>{c.icon || '📁'}</span>
                            )}
                            {c.name}
                          </a>
                        );
                      })
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

      {/* ===== 搜索框 ===== */}
      <form
        action="/posts"
        method="GET"
        style={{ marginBottom: '1.25rem', width: '100%' }}
        onSubmit={(e) => {
          const input = document.getElementById('search-input') as HTMLInputElement;
          if (input && !input.value.trim()) {
            e.preventDefault();
            window.location.href = '/posts';
          }
        }}
      >
        <input
          id="search-input"
          name="search"
          type="text"
          placeholder="🔍 搜索帖子... 按回车搜索"
          defaultValue={searchQuery || ''}
          style={{
            width: '100%',
            padding: '0.6rem 1rem',
            borderRadius: '12px',
            border: '1px solid rgba(0,0,0,0.08)',
            background: 'rgba(255,255,255,0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            fontSize: '0.9rem',
            color: '#333',
            outline: 'none',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            willChange: 'transform, backdrop-filter',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--primary)';
            e.target.style.boxShadow = '0 0 0 3px rgba(var(--primary-rgb, 66, 133, 244), 0.15)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'rgba(0,0,0,0.08)';
            e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
          }}
        />
      </form>
      {searchQuery && (
        <div style={{
          marginTop: '0.5rem',
          marginBottom: '0.8rem',
          padding: '0.3rem 0.8rem',
          background: 'rgba(var(--primary-rgb, 66, 133, 244), 0.08)',
          borderRadius: '8px',
          fontSize: '0.85rem',
          color: 'var(--primary)',
          willChange: 'transform',
        }}>
          🔍 搜索: “{searchQuery}” 
          {posts.length === 0 ? ' — 没有找到相关帖子' : ` — 找到 ${posts.length} 个结果`}
        </div>
      )}
      {/* ===== 漂流瓶 & 情绪容器快捷入口 ===== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
        willChange: 'transform',
      }}>
        <a href="/bottle" style={{
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
          willChange: 'transform',
        }}>
          <span>🍶 漂流瓶</span>
          <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>{bottleCount?.count || 0} 个漂着</span>
        </a>
        <a href="/mood" style={{
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
          willChange: 'transform',
        }}>
          <span>🫙 情绪容器</span>
          <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>{moodCount?.count || 0} 人已表达</span>
        </a>
      </div>

      {currentUser ? (
        userCircles.length > 0 ? (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>📁 我加入的圈子</span>
              <a href="/circles" style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>发现更多 →</a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
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
                      padding: '0.5rem 0.8rem',
                      background: 'linear-gradient(135deg, #f0f4ff, #dce8ff)',
                      borderRadius: '10px',
                      textDecoration: 'none',
                      color: '#1a3a6b',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                      border: '1px solid rgba(66, 133, 244, 0.12)',
                      transition: 'all 0.2s',
                      willChange: 'transform',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {isIconUrl ? (
                        <img 
                          src={circle.icon} 
                          alt={circle.name} 
                          style={{ width: '1.6rem', height: '1.6rem', borderRadius: '6px', objectFit: 'cover' }} 
                        />
                      ) : (
                        <span style={{ fontSize: '1.3rem' }}>{circle.icon || '📁'}</span>
                      )}
                      {circle.name}
                    </span>
                    <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{circle.member_count}人</span>
                  </a>
                );
              })}
            </div>
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
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

      {posts.length > 0 ? (
        <ul style={{
          listStyle: 'none',
          padding: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '1rem',
          willChange: 'transform',
        }}>
          {posts.map((post) => {
            const postAuthor = authors.find(a => a.username === post.author);
            return (
              <li key={post.id} style={{
                border: '1px solid #e8e8e8',
                borderRadius: '12px',
                overflow: 'hidden',
                background: 'white',
                transition: 'box-shadow 0.2s',
                transform: 'translateZ(0)',
                willChange: 'transform',
              }}>
                <a href={`/posts/${post.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                  <div style={{ background: '#f5f5f5', overflow: 'hidden', position: 'relative' }}>
                    {post.file_url ? (
                      post.file_type?.startsWith('image/') ? (
                        <img
                          src={post.file_url}
                          alt={post.title}
                          style={{ width: '100%', height: 'auto', maxHeight: '180px', objectFit: 'cover' }}
                          loading="lazy"
                        />
                      ) : post.file_type?.startsWith('video/') ? (
                        <video
                          src={post.file_url}
                          style={{ width: '100%', maxHeight: '180px' }}
                          muted
                          loop
                          playsInline
                          autoPlay
                        />
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
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        {postAuthor?.avatar ? (
                          <img 
                            src={postAuthor.avatar} 
                            alt={post.author} 
                            style={{ width: '1.2rem', height: '1.2rem', borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <span style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            width: '1.2rem', 
                            height: '1.2rem', 
                            borderRadius: '50%', 
                            background: '#e0e0e0',
                            color: '#666',
                            fontSize: '0.55rem',
                            fontWeight: 600,
                          }}>
                            {post.author.charAt(0).toUpperCase()}
                          </span>
                        )}
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
                    {/* ===== 标签已隐藏 ===== */}
                    {/* {post.tag && (
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
                    )} */}
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <p style={{ textAlign: 'center', color: '#999', padding: '3rem 0' }}>
          {tagName ? `该标签下暂无帖子` : username ? `该用户暂无帖子` : searchQuery ? `没有找到与“${searchQuery}”相关的内容` : `还没有帖子，来发布第一个吧`}
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