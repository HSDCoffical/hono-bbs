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

  // 创建用户名到头像的映射
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

  return c.render(
    <article>
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

      {/* ===== 网格缩略图列表（自适应高度 + R角） ===== */}
      {posts.length > 0 ? (
        <ul class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pl-0">
          {posts.map((post) => (
            <li key={post.id} class="list-none border rounded-xl overflow-hidden shadow hover:shadow-lg transition-shadow duration-200 bg-white dark:bg-gray-800">
              <a href={`/posts/${post.id}`} class="block">
                {/* 缩略图区域 - 自适应高度，R角为 rounded-xl（已由外层容器控制） */}
                <div class="w-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  {post.file_url ? (
                    post.file_type?.startsWith('image/') ? (
                      <img
                        src={post.file_url}
                        alt={post.title}
                        class="w-full h-auto object-contain rounded-t-xl"
                        loading="lazy"
                      />
                    ) : post.file_type?.startsWith('video/') ? (
                      <video
                        src={post.file_url}
                        class="w-full h-auto rounded-t-xl"
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

                {/* 标题和作者信息 */}
                <div class="p-2">
                  <h3 class="text-sm font-semibold truncate" title={post.title}>
                    {post.title}
                  </h3>
                  <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span class="truncate">{post.author}</span>
                    <span class="text-xs whitespace-nowrap">
                      {formatDateTime(post.created_at)}
                    </span>
                  </div>
                  {post.tag && (
                    <span class="inline-block mt-1 bg-gray-200 dark:bg-gray-700 text-xs px-2 py-0.5 rounded">
                      #{post.tag}
                    </span>
                  )}
                </div>
              </a>
            </li>
          ))}
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
    </article>,
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