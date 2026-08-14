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
      {/* ===== 导航栏 ===== */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <a href="/" style={{ fontWeight: 'bold', fontSize: '1.2rem', textDecoration: 'none' }}>☁️ 凉宫社区</a>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <a href="/posts" role="button" class="outline" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem' }}>首页</a>
          <a href="/circles" role="button" class="outline" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem' }}>圈子</a>
          <a href="/bottle" role="button" class="outline" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem' }}>漂流瓶</a>
          <a href="/mood" role="button" class="outline" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem' }}>情绪</a>
          <a href="/capsule" role="button" class="outline" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem' }}>时光信</a>
          {currentUser ? (
            <a href={`/user/${currentUser.id}`} role="button" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem' }}>{currentUser.username}</a>
          ) : (
            <a href="/auth/login" role="button" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem' }}>登录</a>
          )}
        </div>
      </nav>

      {/* ===== 新奇点快捷入口 ===== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '0.75rem',
        marginBottom: '1.5rem'
      }}>
        <a href="/bottle" style={{
          textAlign: 'center',
          padding: '0.75rem',
          background: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)',
          borderRadius: '12px',
          textDecoration: 'none',
          color: '#2e7d32',
          fontSize: '0.85rem'
        }}>
          🍶 漂流瓶<br />
          <small style={{ fontSize: '0.7rem', opacity: 0.7 }}>{bottleCount?.count || 0} 个漂着</small>
        </a>
        <a href="/mood" style={{
          textAlign: 'center',
          padding: '0.75rem',
          background: 'linear-gradient(135deg, #e3f2fd, #bbdefb)',
          borderRadius: '12px',
          textDecoration: 'none',
          color: '#0d47a1',
          fontSize: '0.85rem'
        }}>
          🫙 情绪容器
        </a>
        <a href="/capsule" style={{
          textAlign: 'center',
          padding: '0.75rem',
          background: 'linear-gradient(135deg, #f3e5f5, #e1bee7)',
          borderRadius: '12px',
          textDecoration: 'none',
          color: '#4a148c',
          fontSize: '0.85rem'
        }}>
          📮 时光信
        </a>
        <a href="/circles" style={{
          textAlign: 'center',
          padding: '0.75rem',
          background: 'linear-gradient(135deg, #fff3e0, #ffe0b2)',
          borderRadius: '12px',
          textDecoration: 'none',
          color: '#e65100',
          fontSize: '0.85rem'
        }}>
          📁 圈子
        </a>
      </div>

      {/* ===== 热门圈子快捷入口 ===== */}
      {circles.results && circles.results.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>🔥 热门圈子</span>
            <a href="/circles" style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>查看更多 →</a>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {circles.results.slice(0, 4).map((circle: any) => (
              <a key={circle.id} href={`/circles/${circle.id}`} style={{
                padding: '0.3rem 0.8rem',
                background: '#f0f0f0',
                borderRadius: '20px',
                textDecoration: 'none',
                fontSize: '0.8rem',
                color: '#333'
              }}>
                {circle.icon || '📁'} {circle.name} ({circle.member_count}人)
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 标签导航 */}
      <header class="mb-4">
        <div class="flex items-center text-sm flex-wrap gap-1">
          <a
            href="/posts"
            class={`py-1 px-2 color-[var(--primary-inverse)] no-underline rounded ${
              !tagName && !username ? "bg-gray-2" : ""
            }`}
          >
            全部
          </a>
          {allTags.map((tag) => (
            <a
              key={tag.id}
              href={`/posts?tag=${tag.name}`}
              class={`py-1 px-2 color-[var(--primary-inverse)] rounded no-underline ${
                tagName === tag.name ? "bg-gray-2" : ""
              }`}
            >
              {tag.name}({tag.post_count})
            </a>
          ))}
        </div>
      </header>

      {tagName && <h6 class="mb-2">标签: {tagName}</h6>}
      {username && <h6 class="mb-2">用户: {username} 的帖子</h6>}

      {/* ===== 网格缩略图列表（固定双列，内容完整显示） ===== */}
      {posts.length > 0 ? (
        <ul class="grid grid-cols-2 gap-4 pl-0">
          {posts.map((post) => {
            // 查找当前帖子的作者信息（包含 badge）
            const postAuthor = authors.find(a => a.username === post.author);
            return (
              <li key={post.id} class="list-none border rounded-xl overflow-hidden shadow hover:shadow-lg transition-shadow duration-200 bg-white dark:bg-gray-800">
                <a href={`/posts/${post.id}`} class="block h-full flex flex-col">
                  {/* 缩略图区域 */}
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
                    {/* 评论数角标 */}
                    {post.comment_count !== undefined && post.comment_count > 0 && (
                      <span class="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                        💬 {post.comment_count}
                      </span>
                    )}
                  </div>

                  {/* 标题和作者信息 - 包含 badge 标签 */}
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

// 主页路由，重定向到/posts
index.get("/", (c) => {
  return c.redirect("/posts");
});

export { index };