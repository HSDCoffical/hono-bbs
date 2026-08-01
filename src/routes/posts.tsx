import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { adminOnly, jwtAuth, verify } from "../middleware/auth";
import { CommentService, PostService, TagService, UserService } from "../services";
import type { Bindings, Variables } from "../types/app";
import { ExtendedJWTPayload } from "../types/app";
import { parseMarkdown } from "../utils/markdown";

// ===== 配置 =====
const WORKER_UPLOAD_URL = 'https://github-upload.2791389901.workers.dev/upload';
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
      <header class="mb-2 text-xl font-bold">📤 发布壁纸</header>
      <form action="/posts" method="post" id="post-form" enctype="multipart/form-data">
        {/* ===== 文件上传 ===== */}
        <div>
          <label for="file" class="block font-medium mb-1">选择壁纸（图片/视频）</label>
          <input
            type="file"
            id="file"
            name="file"
            accept="image/*,video/mp4,video/webm"
            required
            class="block w-full text-sm border border-gray-200 rounded-lg p-2"
          />
          <p class="text-xs text-gray-500 mt-1">支持 JPG, PNG, GIF, WebP, MP4, WebM · 最大 10MB</p>
          <div id="preview" class="mt-2"></div>
        </div>

        {/* ===== 标题 ===== */}
        <div class="mt-4">
          <label for="title" class="block font-medium mb-1">标题</label>
          <input type="text" id="title" name="title" required class="w-full border border-gray-200 rounded-lg p-2" />
        </div>

        {/* ===== 描述（可选） ===== */}
        <div class="mt-4">
          <label for="content" class="block font-medium mb-1">描述（可选）</label>
          <textarea
            id="content"
            name="content"
            rows={4}
            placeholder="壁纸描述、来源、分辨率等信息..."
            class="w-full border border-gray-200 rounded-lg p-2"
          ></textarea>
        </div>

        {/* ===== 标签 ===== */}
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
          发布壁纸
        </button>
      </form>

      <script src="/static/preview.js"></script>
    </article>,
    {
      title: "发布壁纸 - 凉宫社区",
      user: user,
    }
  );
});

// 处理新帖子提交 - 需要登录
posts.post("/", jwtAuth, async (c) => {
  const formData = await c.req.formData();
  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim();
  const tag = (formData.get("tag") as string)?.trim();
  const file = formData.get('file') as File | null;

  const user = c.get("user");
  const author = user.username;

  // ===== 验证必填字段 =====
  if (!title || !tag) {
    return c.render(
      <div class="p-4">
        <h1>发布失败</h1>
        <p>标题和标签不能为空</p>
        <a href="/posts/new" className="button">返回</a>
      </div>,
      { title: "发布失败 - 凉宫社区", user }
    );
  }

  // ===== 验证文件 =====
  if (!file || file.size === 0) {
    return c.render(
      <div class="p-4">
        <h1>发布失败</h1>
        <p>请选择文件</p>
        <a href="/posts/new" className="button">返回</a>
      </div>,
      { title: "发布失败 - 凉宫社区", user }
    );
  }

  // ===== 验证文件格式 =====
  if (!ALLOWED_TYPES.includes(file.type)) {
    return c.render(
      <div class="p-4">
        <h1>发布失败</h1>
        <p>不支持的文件格式。仅支持 JPG、PNG、GIF、WebP、MP4、WebM</p>
        <a href="/posts/new" className="button">返回</a>
      </div>,
      { title: "发布失败 - 凉宫社区", user }
    );
  }

  // ===== 验证文件大小 =====
  if (file.size > MAX_FILE_SIZE) {
    return c.render(
      <div class="p-4">
        <h1>发布失败</h1>
        <p>文件大小超过 10MB 限制</p>
        <a href="/posts/new" className="button">返回</a>
      </div>,
      { title: "发布失败 - 凉宫社区", user }
    );
  }

  // ===== 上传文件到 Worker =====
  let fileUrl: string | null = null;
  let fileType: string | null = null;
  let fileSize: number | null = null;

  try {
    const uploadForm = new FormData();
    uploadForm.append('file', file);
    uploadForm.append('uploader', author);

    const response = await fetch(WORKER_UPLOAD_URL, {
      method: 'POST',
      body: uploadForm,
    });
    const result = await response.json();

    if (result.success) {
      fileUrl = result.url;
      fileType = file.type;
      fileSize = file.size;
    } else {
      return c.render(
        <div class="p-4">
          <h1>上传失败</h1>
          <p>文件上传失败：{result.error || '未知错误'}</p>
          <a href="/posts/new" className="button">返回</a>
        </div>,
        { title: "上传失败 - 凉宫社区", user }
      );
    }
  } catch (e) {
    return c.render(
      <div class="p-4">
        <h1>上传失败</h1>
        <p>上传服务异常：{(e as Error).message}</p>
        <a href="/posts/new" className="button">返回</a>
      </div>,
      { title: "上传失败 - 凉宫社区", user }
    );
  }

  // ===== 通过用户名查询用户 ID =====
  const userService = UserService.getInstance(c.env.DB);
  const dbUser = await userService.getUserByUsername(author);
  if (!dbUser) {
    return c.render(
      <div class="p-4">
        <h1>用户不存在</h1>
        <p>无法找到对应的用户记录，请重新登录</p>
        <a href="/user/logout">返回登录</a>
      </div>,
      { title: "用户错误", user }
    );
  }

  // ===== 创建帖子（包含壁纸信息） =====
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

  return c.redirect(`/posts/${postId}`);
});

// 查看单个帖子
posts.get("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const page = parseInt(c.req.query("page") || "1");
  const pageSize = 100;

  const postService = PostService.getInstance(c.env.DB);
  const commentService = CommentService.getInstance(c.env.DB);

  const post = await postService.getPostById(id);
  if (!post) {
    return c.render(
      <div>
        <h1>帖子不存在</h1>
        <p>您请求的帖子不存在或已被删除</p>
        <a href="/">返回首页</a>
      </div>,
      { title: "帖子不存在 - 凉宫社区" }
    );
  }

  const comments = await commentService.getCommentsByPostId(id, page, pageSize);
  const totalComments = await commentService.getCommentCountByPostId(id);
  const totalPages = Math.ceil(totalComments / pageSize);

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

        {/* ===== 展示壁纸（图片/视频） ===== */}
        {post.file_url ? (
          <div class="my-4">
            {post.file_type?.startsWith('image/') ? (
              <img
                src={post.file_url}
                alt={post.title}
                class="max-w-full rounded-lg shadow-lg"
                style={{ maxHeight: '70vh', objectFit: 'contain' }}
              />
            ) : post.file_type?.startsWith('video/') ? (
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

        {/* ===== 文本内容（描述） ===== */}
        {post.content && post.content.trim() !== '' && post.content.trim() !== ' ' && (
          <div class="post-content" dangerouslySetInnerHTML={{ __html: post.content }}></div>
        )}

        {/* ===== 底部信息 ===== */}
        <footer class="flex items-center space-x-2 text-sm mt-4">
          <span class="post-author"><a href={`/profile/${post.author}`}>{post.author}</a></span>
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
                  <svg hx-get={`/posts/${id}/edit`} hx-target="body" hx-push-url="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-5 h-5 cursor-pointer">
                    <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M9 7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-3"></path>
                      <path d="M9 15h3l8.5-8.5a1.5 1.5 0 0 0-3-3L9 12v3"></path>
                      <path d="M16 5l3 3"></path>
                    </g>
                  </svg>
                )
              )}
            </>
          )}
        </footer>
      </article>

      {/* ===== 评论区（保持不变） ===== */}
      <section class="comments">
        {comments.length > 0 ? (
          <>
            <div class="comments-header">评论 ({totalComments})</div>
            <div class="comments-list">
              {comments.map((comment) => (
                <div key={comment.id}>
                  <article>
                    <header class="mb-2 text-sm">
                      <div class="flex items-center space-x-1">
                        {comment.author_avatar && (
                          <img src={`${c.env.GRAVATAR_BASE_URL}${comment.author_avatar}?d=identicon`} alt={`${comment.author}'s avatar`} class="w-5 h-5 rounded-full" hx-get={`profile/${comment.author}`} hx-target="body" hx-push-url="true" />
                        )}
                        <a href={`/profile/${comment.author}`}>{comment.author}</a>
                        <span class="comment-date" data-timestamp={comment.created_at}>
                          {new Date(comment.created_at + "Z").toLocaleString()}
                        </span>
                        {currentUser && (
                          <>
                            {currentUser.role === "admin" ? (
                              <>
                                <svg hx-get={`/posts/${id}/comment/${comment.id}/edit`} hx-target="body" hx-push-url="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-5 h-5 cursor-pointer">
                                  <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M9 7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-3"></path>
                                    <path d="M9 15h3l8.5-8.5a1.5 1.5 0 0 0-3-3L9 12v3"></path>
                                    <path d="M16 5l3 3"></path>
                                  </g>
                                </svg>
                                <svg hx-get={`/posts/${id}/comment/${comment.id}/delete`} hx-target="body" hx-push-url="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" class="w-5 h-5 cursor-pointer">
                                  <path d="M12 12h2v12h-2z" fill="currentColor"></path>
                                  <path d="M18 12h2v12h-2z" fill="currentColor"></path>
                                  <path d="M4 6v2h2v20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8h2V6zm4 22V8h16v20z" fill="currentColor"></path>
                                  <path d="M12 2h8v2h-8z" fill="currentColor"></path>
                                </svg>
                              </>
                            ) : (
                              currentUser.username === comment.author && (
                                <svg hx-get={`/posts/${id}/comment/${comment.id}/edit`} hx-target="body" hx-push-url="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-5 h-5 cursor-pointer">
                                  <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M9 7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-3"></path>
                                    <path d="M9 15h3l8.5-8.5a1.5 1.5 0 0 0-3-3L9 12v3"></path>
                                    <path d="M16 5l3 3"></path>
                                  </g>
                                </svg>
                              )
                            )}
                          </>
                        )}
                        <span class="comment-floor">#{comment.floor_number}楼</span>
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
      title: `${post.title} - 凉宫社区`,
      user: currentUser,
    }
  );
});

// ===== 编辑帖子页面 - 添加了文件上传功能 =====
posts.get("/:id/edit", jwtAuth, async (c) => {
  const id = parseInt(c.req.param("id"));
  const user = c.get("user");

  const postService = PostService.getInstance(c.env.DB);
  const tagService = TagService.getInstance(c.env.DB);

  const post = await postService.getPostById(id);
  if (!post) {
    return c.notFound();
  }

  // 检查权限 - 只有作者或管理员可以编辑
  if (user.username !== post.author && user.role !== "admin") {
    return c.render(
      <div>
        <h1>权限错误</h1>
        <p>您没有权限编辑此帖子</p>
        <a href={`/posts/${id}`} class="button">返回帖子</a>
      </div>,
      { title: "权限错误", user }
    );
  }

  const tags = await tagService.getAllTags();
  const editContent = post.rawContent || post.content.replace(/<[^>]*>/g, "");

  return c.render(
    <article>
      <header>编辑帖子</header>
      <form action={`/posts/${id}/edit`} method="post" id="edit-post-form" enctype="multipart/form-data">
        {/* ===== 文件上传字段（可选） ===== */}
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
          更新帖子
        </button>
      </form>

      {/* ===== 编辑页面预览脚本（外部引用） ===== */}
      <script src="/static/edit-preview.js"></script>
    </article>,
    { title: "编辑帖子", user }
  );
});

// ===== 处理帖子编辑 - 支持文件上传 =====
posts.post("/:id/edit", jwtAuth, async (c) => {
  const id = parseInt(c.req.param("id"));
  const user = c.get("user");

  const postService = PostService.getInstance(c.env.DB);
  const post = await postService.getPostById(id);

  if (!post) {
    return c.notFound();
  }

  // 检查权限 - 只有作者或管理员可以编辑
  if (user.username !== post.author && user.role !== "admin") {
    return c.render(
      <div>
        <h1>权限错误</h1>
        <p>您没有权限编辑此帖子</p>
        <a href={`/posts/${id}`} class="button">返回帖子</a>
      </div>,
      { title: "权限错误", user }
    );
  }

  const formData = await c.req.formData();
  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim();
  const tag = (formData.get("tag") as string)?.trim();
  const file = formData.get('file') as File | null;

  // 验证标题和内容
  if (!title || !content) {
    return c.render(
      <div>
        <h1>编辑失败</h1>
        <p>标题和内容不能为空</p>
        <a href={`/posts/${id}/edit`} class="button">返回</a>
      </div>,
      { title: "编辑失败 - 凉宫社区", user }
    );
  }

  const parsedContent = parseMarkdown(content);

  // ===== 处理文件上传（如果有新文件） =====
  let fileUrl = post.file_url || null;
  let fileType = post.file_type || null;
  let fileSize = post.file_size || null;

  if (file && file.size > 0) {
    // 验证文件格式
    if (!ALLOWED_TYPES.includes(file.type)) {
      return c.render(
        <div class="p-4">
          <h1>上传失败</h1>
          <p>不支持的文件格式。仅支持 JPG、PNG、GIF、WebP、MP4、WebM</p>
          <a href={`/posts/${id}/edit`} className="button">返回</a>
        </div>,
        { title: "上传失败 - 凉宫社区", user }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.render(
        <div class="p-4">
          <h1>上传失败</h1>
          <p>文件大小超过 10MB 限制</p>
          <a href={`/posts/${id}/edit`} className="button">返回</a>
        </div>,
        { title: "上传失败 - 凉宫社区", user }
      );
    }

    try {
      const uploadForm = new FormData();
      uploadForm.append('file', file);
      uploadForm.append('uploader', user.username);

      const response = await fetch(WORKER_UPLOAD_URL, {
        method: 'POST',
        body: uploadForm,
      });
      const result = await response.json();

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
    { title: "上传失败 - 凉宫社区", user }
  );
}

  // ===== 更新帖子 =====
  await postService.updatePost(id, {
    title,
    content: parsedContent,
    rawContent: content,
    tag: tag || null,
    file_url: fileUrl,
    file_type: fileType,
    file_size: fileSize,
  });

  return c.redirect(`/posts/${id}`);
});

// 删除帖子页面 - 需要是管理员
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
      { title: "帖子不存在 - 凉宫社区" }
    );
  }

  if (user.role !== "admin") {
    return c.render(
      <div>
        <h1>权限不足</h1>
        <p>您没有权限删除此帖子</p>
        <a href={`/posts/${id}`}>返回帖子</a>
      </div>,
      { title: "权限不足 - 凉宫社区", user }
    );
  }

  return c.render(
    <article>
      <header>删除帖子</header>
      <div class="card">
        <h3>{post.title}</h3>
        <p>作者: {post.author}</p>
        <p>发布时间: {new Date(post.created_at + "Z").toLocaleDateString()}</p>
        <p class="warning">确定要删除这篇帖子吗？此操作不可撤销。</p>
      </div>
      <footer class="flex space-x-2 items-center">
        <button hx-post={`/posts/${id}/delete`} hx-target="body" hx-push-url="true">确认</button>
        <button hx-get={`/posts/${id}`} hx-target="body" hx-push-url="true" class="contrast">取消</button>
      </footer>
    </article>,
    { title: "删除帖子 - 凉宫社区", user }
  );
});

// 处理帖子删除 - 需要是管理员
posts.post("/:id/delete", jwtAuth, adminOnly, async (c) => {
  const id = parseInt(c.req.param("id"));
  const postService = PostService.getInstance(c.env.DB);
  await postService.deletePost(id);
  return c.redirect("/posts");
});

// 添加评论 - 需要登录
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

  await commentService.createComment({
    post_id: postId,
    content: parsedContent,
    raw_content: content,
    author: user.username,
  });

  return c.redirect(`/posts/${postId}`);
});

// 编辑评论页面 - 管理员可编辑任何评论，普通用户只能编辑自己的评论
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
        <a href={`/posts/${postId}`}>返回帖子</a>
      </div>,
      { title: "评论不存在 - 凉宫社区" }
    );
  }

  if (user.username !== comment.author && user.role !== "admin") {
    return c.render(
      <div>
        <h1>权限错误</h1>
        <p>您没有权限编辑此评论</p>
        <a href={`/posts/${postId}`}>返回帖子</a>
      </div>,
      { title: "权限错误 - 凉宫社区", user }
    );
  }

  return c.render(
    <article>
      <header>编辑评论</header>
      <p>帖子: <a href={`/posts/${postId}`}>{post.title}</a></p>
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
    { title: "编辑评论 - 凉宫社区", user: c.get("user") }
  );
});

// 处理评论编辑 - 管理员可编辑任何评论，普通用户只能编辑自己的评论
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
      { title: "编辑评论失败 - 凉宫社区" }
    );
  }

  const commentService = CommentService.getInstance(c.env.DB);
  const comment = await commentService.getCommentById(commentId);

  if (!comment) {
    return c.render(
      <div>
        <h1>评论不存在</h1>
        <p>您请求的评论不存在或已被删除</p>
        <a href={`/posts/${postId}`}>返回帖子</a>
      </div>,
      { title: "评论不存在 - 凉宫社区" }
    );
  }

  if (user.username !== comment.author && user.role !== "admin") {
    return c.render(
      <div>
        <h1>权限错误</h1>
        <p>您没有权限编辑此评论</p>
        <a href={`/posts/${postId}`}>返回帖子</a>
      </div>,
      { title: "权限错误 - 凉宫社区", user }
    );
  }

  const parsedContent = parseMarkdown(content);
  const success = await commentService.updateComment(commentId, parsedContent, content);

  if (!success) {
    return c.render(
      <div>
        <h1>编辑评论失败</h1>
        <p>评论更新失败，请稍后再试</p>
        <a href={`/posts/${postId}`}>返回帖子</a>
      </div>,
      { title: "编辑评论失败 - 凉宫社区" }
    );
  }

  return c.redirect(`/posts/${postId}`);
});

// 删除评论确认页面 - 仅管理员可用
posts.get("/:postId/comment/:commentId/delete", jwtAuth, adminOnly, async (c) => {
  const postId = parseInt(c.req.param("postId"));
  const commentId = parseInt(c.req.param("commentId"));

  const postService = PostService.getInstance(c.env.DB);
  const commentService = CommentService.getInstance(c.env.DB);

  const post = await postService.getPostById(postId);
  const comment = await commentService.getCommentById(commentId);

  if (!post || !comment) {
    return c.render(
      <div>
        <h1>评论不存在</h1>
        <p>您请求的评论不存在或已被删除</p>
        <a href={`/posts/${postId}`}>返回帖子</a>
      </div>,
      { title: "评论不存在 - 凉宫社区" }
    );
  }

  return c.render(
    <article>
      <header>确认删除评论</header>
      <p>您确定要删除这条评论吗？此操作不可撤销。</p>
      <p>帖子: <a href={`/posts/${postId}`}>{post.title}</a></p>
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
    { title: "删除评论 - 凉宫社区", user: c.get("user") }
  );
});

// 处理评论删除 - 仅管理员可用
posts.post("/:postId/comment/:commentId/delete", jwtAuth, adminOnly, async (c) => {
  const postId = parseInt(c.req.param("postId"));
  const commentId = parseInt(c.req.param("commentId"));

  const commentService = CommentService.getInstance(c.env.DB);
  const success = await commentService.deleteComment(commentId);

  if (!success) {
    return c.render(
      <div>
        <h1>删除评论失败</h1>
        <p>评论删除失败，请稍后再试</p>
        <a href={`/posts/${postId}`}>返回帖子</a>
      </div>,
      { title: "删除评论失败 - 凉宫社区" }
    );
  }

  return c.redirect(`/posts/${postId}`);
});

export { posts };