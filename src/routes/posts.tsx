import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { adminOnly, jwtAuth, verify } from "../middleware/auth";
import { CommentService, PostService, TagService, UserService } from "../services";
import type { Bindings, Variables } from "../types/app";
import { ExtendedJWTPayload } from "../types/app";
import { parseMarkdown } from "../utils/markdown";

// ===== 配置 =====
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
// =================

const posts = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 获取所有帖子（重定向到首页）
posts.get("/", async (c) => {
  return c.redirect("/");
});

// 创建新帖子页面 - 需要登录
posts.get("/new", jwtAuth, async (c) => {
  const tagService = TagService.getInstance(c.env.DB);
  const tags = await tagService.getAllTags();
  const user = c.get("user");

  return c.render(
    <article>
      <header class="mb-2 text-xl font-bold">📤 上传媒体文件</header>
      <form action="/posts" method="post" id="post-form" enctype="multipart/form-data">
        <div>
          <label for="file" class="block font-medium mb-1">选择文件（图片/视频）</label>
          <input
            type="file"
            id="file"
            name="file"
            accept="image/*,video/mp4,video/webm"
            required
            class="block w-full text-sm border border-gray-200 rounded-lg p-2"
          />
          <p class="text-xs text-gray-500 mt-1">仅支持 JPG, PNG, GIF, WebP, MP4, WebM · 且单个文件最大支持 10MB</p>
          <div id="preview" class="mt-2"></div>
        </div>

        <div class="mt-4">
          <label for="title" class="block font-medium mb-1">标题</label>
          <input type="text" id="title" name="title" required class="w-full border border-gray-200 rounded-lg p-2" />
        </div>

        <div class="mt-4">
          <label for="content" class="block font-medium mb-1">内容</label>
          <textarea
            id="content"
            name="content"
            rows={4}
            placeholder="请输入文本"
            class="w-full border border-gray-200 rounded-lg p-2"
          ></textarea>
        </div>

        <div class="mt-4">
          <label for="tag" class="block font-medium mb-1">标签</label>
          <select id="tag" name="tag" required class="w-full border border-gray-200 rounded-lg p-2">
            <option value="">-- 请选择标签 --</option>
            {tags.map((tag) => (
              <option value={tag.name}>{tag.name}</option>
            ))}
          </select>
        </div>

        <button type="submit" class="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
          发布帖子
        </button>
      </form>

      <script src="/static/preview.js"></script>
    </article>,
    {
      title: "发布帖子 - 凉宫数据",
      user: user,
    }
  );
});

// 处理新帖子提交 - 需要登录
posts.post("/", jwtAuth, async (c) => {
  const origin = new URL(c.req.url).origin;
  const uploadUrl = `${origin}/api/upload`;

  const formData = await c.req.formData();
  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim();
  const tag = (formData.get("tag") as string)?.trim();
  const file = formData.get('file') as File | null;

  const user = c.get("user");
  const author = user.username;

  if (!title || !tag) {
    return c.render(
      <div class="p-4">
        <h1>发布失败</h1>
        <p>标题和标签不能为空</p>
        <a href="/posts/new" className="button">返回</a>
      </div>,
      { title: "发布失败 - 凉宫数据", user }
    );
  }

  if (!file || file.size === 0) {
    return c.render(
      <div class="p-4">
        <h1>发布失败</h1>
        <p>请选择文件</p>
        <a href="/posts/new" className="button">返回</a>
      </div>,
      { title: "发布失败 - 凉宫数据", user }
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return c.render(
      <div class="p-4">
        <h1>发布失败</h1>
        <p>不支持的文件格式。仅支持 JPG、PNG、GIF、WebP、MP4、WebM</p>
        <a href="/posts/new" className="button">返回</a>
      </div>,
      { title: "发布失败 - 凉宫数据", user }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return c.render(
      <div class="p-4">
        <h1>发布失败</h1>
        <p>文件大小超过 10MB 限制</p>
        <a href="/posts/new" className="button">返回</a>
      </div>,
      { title: "发布失败 - 凉宫数据", user }
    );
  }

  let fileUrl: string | null = null;
  let fileType: string | null = null;
  let fileSize: number | null = null;

  try {
    const uploadForm = new FormData();
    uploadForm.append('file', file);
    uploadForm.append('uploader', author);

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: uploadForm,
    });

    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      return c.render(
        <div class="p-4">
          <h1>上传失败</h1>
          <p>服务器返回了无效的响应格式</p>
          <pre class="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto" style="max-height:200px;">{responseText.substring(0, 500)}</pre>
          <a href="/posts/new" className="button">返回</a>
        </div>,
        { title: "上传失败 - 凉宫数据", user }
      );
    }

    if (result.success) {
      fileUrl = result.url;
      fileType = file.type;
      fileSize = file.size;
    } else {
      const errorMsg = result.error || '未知错误';
      const detailMsg = result.detail || '';
      return c.render(
        <div class="p-4">
          <h1>上传失败</h1>
          <p>文件上传失败：{errorMsg}</p>
          {detailMsg && <pre class="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto" style="max-height:200px;">{detailMsg}</pre>}
          <a href="/posts/new" className="button">返回</a>
        </div>,
        { title: "上传失败 - 凉宫数据", user }
      );
    }
  } catch (e) {
    return c.render(
      <div class="p-4">
        <h1>上传失败</h1>
        <p>上传服务异常：{(e as Error).message}</p>
        <a href="/posts/new" className="button">返回</a>
      </div>,
      { title: "上传失败 - 凉宫数据", user }
    );
  }

  const userService = UserService.getInstance(c.env.DB);
  const dbUser = await userService.getUserByUsername(author);
  if (!dbUser) {
    return c.render(
      <div>
        <h1>用户不存在</h1>
        <p>无法找到对应的用户记录，请重新登录</p>
        <a href="/user/logout">返回登录</a>
      </div>,
      { title: "用户错误", user }
    );
  }

  const userId = dbUser.id;
  const postService = PostService.getInstance(c.env.DB);
  const parsedContent = content ? parseMarkdown(content) : '';

  const postId = await postService.createPost({
    title,
    content: parsedContent || ' ',
    rawContent: content || '',
    author,
    tag,
    user_id: userId,
    file_url: fileUrl,
    file_type: fileType,
    file_size: fileSize,
  });

  if (!postId) {
    return c.redirect('/posts');
  }

  return c.redirect(`/posts/${postId}`, 303);
});

// ===== 查看单个帖子（含评论列表，已添加 data 属性及删除按钮，支持 badge 标签） =====
posts.get("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const page = parseInt(c.req.query("page") || "1");
  const pageSize = 100;

  const postService = PostService.getInstance(c.env.DB);
  const commentService = CommentService.getInstance(c.env.DB);
  const userService = UserService.getInstance(c.env.DB);

  const post = await postService.getPostById(id);
  if (!post) {
    return c.render(
      <div>
        <h1>壁纸不存在</h1>
        <p>您请求的壁纸不存在或已被删除</p>
        <a href="/">返回首页</a>
      </div>,
      { title: "壁纸不存在 - 凉宫数据" }
    );
  }

  const comments = await commentService.getCommentsByPostId(id, page, pageSize);
  const totalComments = await commentService.getCommentCountByPostId(id);
  const totalPages = Math.ceil(totalComments / pageSize);

  // ★ 获取帖子作者的 badge
  let postAuthor = null;
  if (post) {
    postAuthor = await userService.getUserByUsername(post.author);
  }

  // ★ 获取所有评论作者的 badge
  const commentAuthors = comments.length > 0 
    ? await userService.getUsersByUsernames(comments.map(c => c.author))
    : [];
  const commentAuthorMap = Object.fromEntries(
    commentAuthors.map(a => [a.username, a])
  );

  const token = getCookie(c, "auth_token");
  let currentUser: ExtendedJWTPayload | null = null;
  if (token) {
    try {
      currentUser = (await verify(token, c.env.JWT_SECRET)) as ExtendedJWTPayload;
    } catch (_) { /* ignore */ }
  }

  return c.render(
    <div>
      <article class="post">
        <header class="mb-2">
          <div class="text-xl font-bold">{post.title}</div>
        </header>

        {post.file_url ? (
          <div class="my-4">
            {(post.file_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(post.file_url)) ? (
              <img
                src={post.file_url}
                alt={post.title}
                class="max-w-full rounded-lg shadow-lg"
                style={{ maxHeight: '70vh', objectFit: 'contain' }}
              />
            ) : (post.file_type?.startsWith('video/') || /\.(mp4|webm|ogg|mov)$/i.test(post.file_url)) ? (
              <video
                src={post.file_url}
                controls
                class="max-w-full rounded-lg shadow-lg"
                style={{ maxHeight: '70vh' }}
              />
            ) : (
              <a href={post.file_url} target="_blank" class="text-blue-600">查看文件</a>
            )}
            {post.file_size && (
              <p class="text-xs text-gray-500 mt-1">文件大小: {(post.file_size / 1024).toFixed(1)} KB</p>
            )}
          </div>
        ) : null}

        {post.content && post.content.trim() !== '' && post.content.trim() !== ' ' && (
          <div class="post-content" dangerouslySetInnerHTML={{ __html: post.content }}></div>
        )}

        <footer class="flex items-center space-x-2 text-sm mt-4">
          <span class="post-author">
            <a href={`/profile/${post.author}`}>{post.author}</a>
            {/* ★ 帖子作者 badge 标签 */}
            {postAuthor?.badge && (
              <span class="ml-1 inline-block bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full align-middle">
                {postAuthor.badge}
              </span>
            )}
          </span>
          {post.tag && (
            <a class="bg-gray-2 p-1 rounded text-xs no-underline color-[var(--primary-inverse)]" href={`/posts?tag=${post.tag}`}>
              {post.tag}
            </a>
          )}
          <span data-timestamp={post.created_at}>
            {new Date(post.created_at + "Z").toLocaleString()}
          </span>
          {currentUser && (
            <>
              {currentUser.role === "admin" ? (
                <>
                  <svg hx-get={`/posts/${id}/edit`} hx-target="body" hx-push-url="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-5 h-5 cursor-pointer">
                    <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M9 7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-3"></path>
                      <path d="M9 15h3l8.5-8.5a1.5 1.5 0 0 0-3-3L9 12v3"></path>
                      <path d="M16 5l3 3"></path>
                    </g>
                  </svg>
                  <svg hx-get={`/posts/${id}/delete`} hx-target="body" hx-push-url="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" class="w-5 h-5 cursor-pointer">
                    <path d="M12 12h2v12h-2z" fill="currentColor"></path>
                    <path d="M18 12h2v12h-2z" fill="currentColor"></path>
                    <path d="M4 6v2h2v20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8h2V6zm4 22V8h16v20z" fill="currentColor"></path>
                    <path d="M12 2h8v2h-8z" fill="currentColor"></path>
                  </svg>
                </>
              ) : (
                currentUser.username === post.author && (
                  <>
                    <svg hx-get={`/posts/${id}/edit`} hx-target="body" hx-push-url="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-5 h-5 cursor-pointer">
                      <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-3"></path>
                        <path d="M9 15h3l8.5-8.5a1.5 1.5 0 0 0-3-3L9 12v3"></path>
                        <path d="M16 5l3 3"></path>
                      </g>
                    </svg>
                    <svg hx-get={`/posts/${id}/delete`} hx-target="body" hx-push-url="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" class="w-5 h-5 cursor-pointer">
                      <path d="M12 12h2v12h-2z" fill="currentColor"></path>
                      <path d="M18 12h2v12h-2z" fill="currentColor"></path>
                      <path d="M4 6v2h2v20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8h2V6zm4 22V8h16v20z" fill="currentColor"></path>
                      <path d="M12 2h8v2h-8z" fill="currentColor"></path>
                    </svg>
                  </>
                )
              )}
            </>
          )}
        </footer>
      </article>

      <section class="comments">
        {comments.length > 0 ? (
          <>
            <div class="comments-header">评论 ({totalComments})</div>
            <div class="comments-list">
              {comments.map((comment) => (
                <div 
                  key={comment.id}
                  data-comment-id={comment.id}
                  data-comment-author={comment.author}
                  data-post-id={id}
                  style={{ position: 'relative' }}
                >
                  <article>
                    <header class="mb-2 text-sm">
                      <div class="flex items-center space-x-1">
                        {comment.author_avatar && (
                          <img src={`${c.env.GRAVATAR_BASE_URL}${comment.author_avatar}?d=identicon`} alt={`${comment.author}'s avatar`} class="w-5 h-5 rounded-full" hx-get={`profile/${comment.author}`} hx-target="body" hx-push-url="true" />
                        )}
                        <a href={`/profile/${comment.author}`}>
                          {comment.author}
                          {/* ★ 评论作者 badge 标签 */}
                          {commentAuthorMap[comment.author]?.badge && (
                            <span class="ml-1 inline-block bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full align-middle">
                              {commentAuthorMap[comment.author].badge}
                            </span>
                          )}
                        </a>
                        <span class="comment-date" data-timestamp={comment.created_at}>
                          {new Date(comment.created_at + "Z").toLocaleString()}
                        </span>
                        <span class="comment-floor">#{comment.floor_number}楼</span>
                        {/* 编辑按钮（仅作者和管理员） */}
                        {currentUser && (currentUser.role === "admin" || currentUser.username === comment.author) && (
                          <svg hx-get={`/posts/${id}/comment/${comment.id}/edit`} hx-target="body" hx-push-url="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-5 h-5 cursor-pointer">
                            <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M9 7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-3"></path>
                              <path d="M9 15h3l8.5-8.5a1.5 1.5 0 0 0-3-3L9 12v3"></path>
                              <path d="M16 5l3 3"></path>
                            </g>
                          </svg>
                        )}
                        {/* 删除按钮（仅作者和管理员，置于最右） */}
                        {currentUser && (currentUser.role === "admin" || currentUser.username === comment.author) && (
                          <svg hx-get={`/posts/${id}/comment/${comment.id}/delete`} hx-target="body" hx-push-url="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" class="w-5 h-5 cursor-pointer ml-auto">
                            <path d="M12 12h2v12h-2z" fill="currentColor"></path>
                            <path d="M18 12h2v12h-2z" fill="currentColor"></path>
                            <path d="M4 6v2h2v20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8h2V6zm4 22V8h16v20z" fill="currentColor"></path>
                            <path d="M12 2h8v2h-8z" fill="currentColor"></path>
                          </svg>
                        )}
                      </div>
                    </header>
                    <div dangerouslySetInnerHTML={{ __html: parseMarkdown(comment.content) }}></div>
                  </article>
                </div>
              ))}
            </div>
            <div class="pagination">
              {totalPages > 1 &&
                Array.from({ length: totalPages }, (_, i) => (
                  <a key={i} href={`/posts/${id}?page=${i+1}`} class={`page-item ${page === i+1 ? "active" : ""}`}>
                    {i+1}
                  </a>
                ))}
            </div>
          </>
        ) : (
          <p>暂无评论</p>
        )}
        {currentUser ? (
          <article>
            <form action={`/posts/${id}/comment`} method="post" class="comment-form" id="comment-form">
              <h4>发表评论</h4>
              <div><textarea id="content" name="content" rows={5} required placeholder="在此输入评论内容..."></textarea></div>
              <button type="submit">提交评论</button>
            </form>
          </article>
        ) : (
          <p><a href={`/user/login?redirect=/posts/${id}`}>登录</a> 后才能发表评论</p>
        )}
      </section>
    </div>,
    {
      title: `${post.title} - 凉宫数据`,
      user: currentUser,
    }
  );
});
// ===== 编辑壁纸页面 =====
posts.get("/:id/edit", jwtAuth, async (c) => {
  const id = parseInt(c.req.param("id"));
  const user = c.get("user");

  const postService = PostService.getInstance(c.env.DB);
  const tagService = TagService.getInstance(c.env.DB);

  const post = await postService.getPostById(id);
  if (!post) {
    return c.notFound();
  }

  if (user.username !== post.author && user.role !== "admin") {
    return c.render(
      <div>
        <h1>权限错误</h1>
        <p>您没有权限编辑此壁纸</p>
        <a href={`/posts/${id}`} class="button">返回壁纸</a>
      </div>,
      { title: "权限错误", user }
    );
  }

  const tags = await tagService.getAllTags();
  const editContent = post.rawContent || post.content.replace(/<[^>]*>/g, "");

  return c.render(
    <article>
      <header>编辑壁纸</header>
      <form action={`/posts/${id}/edit`} method="post" id="edit-post-form" enctype="multipart/form-data">
        <div>
          <label for="file" class="block font-medium mb-1">
            {post.file_url ? '更换壁纸' : '添加壁纸'}（可选）
          </label>
          <input
            type="file"
            id="file"
            name="file"
            accept="image/*,video/mp4,video/webm"
            class="block w-full text-sm border border-gray-200 rounded-lg p-2"
          />
          <p class="text-xs text-gray-500 mt-1">支持 JPG, PNG, GIF, WebP, MP4, WebM · 最大 10MB</p>
          <div id="edit-preview" class="mt-2"></div>
          {post.file_url && (
            <div class="mt-2">
              <p class="text-xs text-gray-500">
                当前壁纸：<a href={post.file_url} target="_blank" class="text-blue-600">查看</a>
              </p>
            </div>
          )}
        </div>

        <div class="mt-4">
          <label for="title" class="block font-medium mb-1">标题</label>
          <input type="text" id="title" name="title" value={post.title} required class="w-full border border-gray-200 rounded-lg p-2" />
        </div>

        <div class="mt-4">
          <label for="content" class="block font-medium mb-1">内容</label>
          <textarea id="content" name="content" required rows={20} placeholder="在此输入内容，支持 Markdown 格式..." class="w-full border border-gray-200 rounded-lg p-2">
            {editContent.trim()}
          </textarea>
        </div>

        <div class="mt-4">
          <label for="tag" class="block font-medium mb-1">标签</label>
          <select id="tag" name="tag" class="w-full border border-gray-200 rounded-lg p-2">
            <option value="">-- 选择标签 --</option>
            {tags.map((tag) => (
              <option value={tag.name} selected={post.tag === tag.name}>{tag.name}</option>
            ))}
          </select>
        </div>

        <button type="submit" class="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
          更新壁纸
        </button>
      </form>

      <script src="/static/edit-preview.js"></script>
    </article>,
    { title: "编辑壁纸", user }
  );
});

// ===== 处理壁纸编辑 - 支持文件上传 =====
posts.post("/:id/edit", jwtAuth, async (c) => {
  const origin = new URL(c.req.url).origin;
  const uploadUrl = `${origin}/api/upload`;

  const id = parseInt(c.req.param("id"));
  const user = c.get("user");

  const postService = PostService.getInstance(c.env.DB);
  const post = await postService.getPostById(id);

  if (!post) {
    return c.notFound();
  }

  if (user.username !== post.author && user.role !== "admin") {
    return c.render(
      <div>
        <h1>权限错误</h1>
        <p>您没有权限编辑此壁纸</p>
        <a href={`/posts/${id}`} class="button">返回壁纸</a>
      </div>,
      { title: "权限错误", user }
    );
  }

  const formData = await c.req.formData();
  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim();
  const tag = (formData.get("tag") as string)?.trim();
  const file = formData.get('file') as File | null;

  if (!title || !content) {
    return c.render(
      <div>
        <h1>编辑失败</h1>
        <p>标题和内容不能为空</p>
        <a href={`/posts/${id}/edit`} class="button">返回</a>
      </div>,
      { title: "编辑失败 - 凉宫数据", user }
    );
  }

  const parsedContent = parseMarkdown(content);

  let fileUrl = post.file_url || null;
  let fileType = post.file_type || null;
  let fileSize = post.file_size || null;

  if (file && file.size > 0) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return c.render(
        <div class="p-4">
          <h1>上传失败</h1>
          <p>不支持的文件格式。仅支持 JPG、PNG、GIF、WebP、MP4、WebM</p>
          <a href={`/posts/${id}/edit`} className="button">返回</a>
        </div>,
        { title: "上传失败 - 凉宫数据", user }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.render(
        <div class="p-4">
          <h1>上传失败</h1>
          <p>文件大小超过 10MB 限制</p>
          <a href={`/posts/${id}/edit`} className="button">返回</a>
        </div>,
        { title: "上传失败 - 凉宫数据", user }
      );
    }

    try {
      const uploadForm = new FormData();
      uploadForm.append('file', file);
      uploadForm.append('uploader', user.username);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: uploadForm,
      });

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        return c.render(
          <div class="p-4">
            <h1>上传失败</h1>
            <p>服务器返回了无效的响应格式</p>
            <pre class="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto" style="max-height:200px;">{responseText.substring(0, 500)}</pre>
            <a href={`/posts/${id}/edit`} className="button">返回</a>
          </div>,
          { title: "上传失败 - 凉宫数据", user }
        );
      }

      if (result.success) {
        fileUrl = result.url;
        fileType = file.type;
        fileSize = file.size;
      } else {
        const errorMsg = result.error || '未知错误';
        const detailMsg = result.detail || '';
        return c.render(
          <div class="p-4">
            <h1>上传失败</h1>
            <p>文件上传失败：{errorMsg}</p>
            {detailMsg && <pre class="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto" style="max-height:200px;">{detailMsg}</pre>}
            <a href={`/posts/${id}/edit`} className="button">返回</a>
          </div>,
          { title: "上传失败 - 凉宫数据", user }
        );
      }
    } catch (e) {
      return c.render(
        <div class="p-4">
          <h1>上传失败</h1>
          <p>上传服务异常：{(e as Error).message}</p>
          <a href={`/posts/${id}/edit`} className="button">返回</a>
        </div>,
        { title: "上传失败 - 凉宫数据", user }
      );
    }
  }

  // 修复 D1 类型错误：使用 ?? null 确保不传入 undefined
  await postService.updatePost(id, {
    title,
    content: parsedContent,
    rawContent: content,
    tag: tag || null,
    file_url: fileUrl ?? null,
    file_type: fileType ?? null,
    file_size: fileSize ?? null,
  });
  return c.redirect(`/posts/${id}`, 303);
});

// ===== 删除帖子（作者或管理员） =====
// 删除确认页面（作者或管理员可访问）
posts.get("/:id/delete", jwtAuth, async (c) => {
  const id = parseInt(c.req.param("id"));
  const user = c.get("user");

  const postService = PostService.getInstance(c.env.DB);
  const post = await postService.getPostById(id);

  if (!post) {
    return c.render(
      <div>
        <h1>帖子不存在</h1>
        <p>您请求的帖子不存在或已被删除</p>
        <a href="/">返回首页</a>
      </div>,
      { title: "帖子不存在 - 凉宫数据" }
    );
  }

  // 权限检查：仅作者或管理员可访问删除页面
  if (user.role !== "admin" && user.username !== post.author) {
    return c.render(
      <div>
        <h1>权限不足</h1>
        <p>您没有权限删除此帖子</p>
        <a href={`/posts/${id}`}>返回帖子</a>
      </div>,
      { title: "权限不足 - 凉宫数据", user }
    );
  }

  return c.render(
    <article>
      <header>删除壁纸</header>
      <div class="card">
        <h3>{post.title}</h3>
        <p>作者: {post.author}</p>
        <p>发布时间: {new Date(post.created_at + "Z").toLocaleDateString()}</p>
        <p class="warning">确定要删除这条帖子吗？此操作不可撤销。</p>
      </div>
      <footer class="flex space-x-2 items-center">
        <button hx-post={`/posts/${id}/delete`} hx-target="body" hx-push-url="true">确认</button>
        <button hx-get={`/posts/${id}`} hx-target="body" hx-push-url="true" class="contrast">取消</button>
      </footer>
    </article>,
    { title: "删除帖子 - 凉宫数据", user }
  );
});

// 处理壁纸删除（作者或管理员）
posts.post("/:id/delete", jwtAuth, async (c) => {
  const id = parseInt(c.req.param("id"));
  const user = c.get("user");

  const postService = PostService.getInstance(c.env.DB);
  const post = await postService.getPostById(id);

  if (!post) {
    return c.render(
      <div>
        <h1>帖子不存在</h1>
        <p>您请求的帖子不存在或已被删除</p>
        <a href="/">返回首页</a>
      </div>,
      { title: "帖子不存在 - 凉宫数据" }
    );
  }

  // 权限检查：仅作者或管理员可删除
  if (user.role !== "admin" && user.username !== post.author) {
    return c.render(
      <div>
        <h1>权限不足</h1>
        <p>您没有权限删除此壁纸</p>
        <a href={`/posts/${id}`}>返回壁纸</a>
      </div>,
      { title: "权限不足 - 凉宫数据", user }
    );
  }

  await postService.deletePost(id);
  return c.redirect("/posts", 303);
});

// ===== 添加评论 =====
posts.post("/:id/comment", jwtAuth, async (c) => {
  const postId = parseInt(c.req.param("id"));
  const formData = await c.req.formData();
  const content = (formData.get("content") as string)?.trim();

  if (!content) {
    return c.redirect(`/posts/${postId}`);
  }

  const user = c.get("user");
  const commentService = CommentService.getInstance(c.env.DB);
  const parsedContent = parseMarkdown(content);

  // ★ 关键修复：传入 user_id ★
  await commentService.createComment({
    post_id: postId,
    content: parsedContent,
    raw_content: content,
    author: user.username,
    user_id: user.id,   // 添加此行，解决 NOT NULL 约束错误
  });

  return c.redirect(`/posts/${postId}`, 303);
});

// ===== 编辑评论 =====
posts.get("/:postId/comment/:commentId/edit", jwtAuth, async (c) => {
  const postId = parseInt(c.req.param("postId"));
  const commentId = parseInt(c.req.param("commentId"));
  const user = c.get("user");

  const postService = PostService.getInstance(c.env.DB);
  const commentService = CommentService.getInstance(c.env.DB);

  const post = await postService.getPostById(postId);
  const comment = await commentService.getCommentById(commentId);

  if (!post || !comment) {
    return c.render(
      <div>
        <h1>评论不存在</h1>
        <p>您请求的评论不存在或已被删除</p>
        <a href={`/posts/${postId}`}>返回壁纸</a>
      </div>,
      { title: "评论不存在 - 凉宫数据" }
    );
  }

  if (user.username !== comment.author && user.role !== "admin") {
    return c.render(
      <div>
        <h1>权限错误</h1>
        <p>您没有权限编辑此评论</p>
        <a href={`/posts/${postId}`}>返回壁纸</a>
      </div>,
      { title: "权限错误 - 凉宫数据", user }
    );
  }

  return c.render(
    <article>
      <header>编辑评论</header>
      <p>壁纸: <a href={`/posts/${postId}`}>{post.title}</a></p>
      <form action={`/posts/${postId}/comment/${commentId}/edit`} method="post" class="form-card" id="comment-form">
        <div class="form-group">
          <label htmlFor="content">评论内容:</label>
          <textarea id="content" name="content" rows={5} required placeholder="在此输入评论内容...">
            {(comment.raw_content || comment.content).trim()}
          </textarea>
        </div>
        <button type="submit" class="bg-blue-500 text-white px-4 py-2 rounded">更新评论</button>
      </form>
    </article>,
    { title: "编辑评论 - 凉宫数据", user: c.get("user") }
  );
});

posts.post("/:postId/comment/:commentId/edit", jwtAuth, async (c) => {
  const postId = parseInt(c.req.param("postId"));
  const commentId = parseInt(c.req.param("commentId"));
  const user = c.get("user");

  const formData = await c.req.formData();
  const content = (formData.get("content") as string)?.trim();

  if (!content) {
    return c.render(
      <div>
        <h1>编辑评论失败</h1>
        <p>评论内容不能为空</p>
        <a href={`/posts/${postId}/comment/${commentId}/edit`}>返回</a>
      </div>,
      { title: "编辑评论失败 - 凉宫数据", user }
    );
  }

  const commentService = CommentService.getInstance(c.env.DB);
  const comment = await commentService.getCommentById(commentId);

  if (!comment) {
    return c.render(
      <div>
        <h1>评论不存在</h1>
        <p>您请求的评论不存在或已被删除</p>
        <a href={`/posts/${postId}`}>返回壁纸</a>
      </div>,
      { title: "评论不存在 - 凉宫数据" }
    );
  }

  if (user.username !== comment.author && user.role !== "admin") {
    return c.render(
      <div>
        <h1>权限错误</h1>
        <p>您没有权限编辑此评论</p>
        <a href={`/posts/${postId}`}>返回壁纸</a>
      </div>,
      { title: "权限错误 - 凉宫数据", user }
    );
  }

  const parsedContent = parseMarkdown(content);
  const success = await commentService.updateComment(commentId, parsedContent, content);

  if (!success) {
    return c.render(
      <div>
        <h1>编辑评论失败</h1>
        <p>评论更新失败，请稍后再试</p>
        <a href={`/posts/${postId}`}>返回壁纸</a>
      </div>,
      { title: "编辑评论失败 - 凉宫数据", user }
    );
  }

  return c.redirect(`/posts/${postId}`, 303);
});

// ===== 删除评论（作者或管理员） =====
// 删除确认页面（作者或管理员可访问）
posts.get("/:postId/comment/:commentId/delete", jwtAuth, async (c) => {
  const postId = parseInt(c.req.param("postId"));
  const commentId = parseInt(c.req.param("commentId"));
  const user = c.get("user");

  const postService = PostService.getInstance(c.env.DB);
  const commentService = CommentService.getInstance(c.env.DB);

  const post = await postService.getPostById(postId);
  const comment = await commentService.getCommentById(commentId);

  if (!post || !comment) {
    return c.render(
      <div>
        <h1>评论不存在</h1>
        <p>您请求的评论不存在或已被删除</p>
        <a href={`/posts/${postId}`}>返回壁纸</a>
      </div>,
      { title: "评论不存在 - 凉宫数据" }
    );
  }

  // 权限检查：仅作者或管理员可访问删除确认页
  if (user.role !== "admin" && user.username !== comment.author) {
    return c.render(
      <div>
        <h1>权限不足</h1>
        <p>您没有权限删除此评论</p>
        <a href={`/posts/${postId}`}>返回壁纸</a>
      </div>,
      { title: "权限不足 - 凉宫数据", user }
    );
  }

  return c.render(
    <article>
      <header>确认删除评论</header>
      <p>您确定要删除这条评论吗？此操作不可撤销。</p>
      <p>壁纸: <a href={`/posts/${postId}`}>{post.title}</a></p>
      <p>评论作者: {comment.author}</p>
      <div class="p-4 border rounded my-4">
        <h4>评论内容:</h4>
        <div dangerouslySetInnerHTML={{ __html: comment.content }}></div>
      </div>
      <footer class="mt-4 space-x-4">
        <button hx-post={`/posts/${postId}/comment/${commentId}/delete`} hx-target="body" hx-push-url="true" class="contrast">确认</button>
        <button hx-get={`/posts/${postId}`} hx-target="body" hx-push-url="true">取消</button>
      </footer>
    </article>,
    { title: "删除评论 - 凉宫数据", user: c.get("user") }
  );
});

// 处理评论删除（作者或管理员）
posts.post("/:postId/comment/:commentId/delete", jwtAuth, async (c) => {
  const postId = parseInt(c.req.param("postId"));
  const commentId = parseInt(c.req.param("commentId"));
  const user = c.get("user");

  const commentService = CommentService.getInstance(c.env.DB);
  const comment = await commentService.getCommentById(commentId);

  if (!comment) {
    return c.render(
      <div>
        <h1>评论不存在</h1>
        <p>您请求的评论不存在或已被删除</p>
        <a href={`/posts/${postId}`}>返回壁纸</a>
      </div>,
      { title: "评论不存在 - 凉宫数据", user }
    );
  }

  // 权限检查：仅作者或管理员可删除
  if (user.role !== "admin" && user.username !== comment.author) {
    return c.render(
      <div>
        <h1>权限不足</h1>
        <p>您没有权限删除此评论</p>
        <a href={`/posts/${postId}`}>返回壁纸</a>
      </div>,
      { title: "权限不足 - 凉宫数据", user }
    );
  }

  await commentService.deleteComment(commentId);
  return c.redirect(`/posts/${postId}`, 303);
});

export { posts };