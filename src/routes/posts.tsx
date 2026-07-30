import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { adminOnly, jwtAuth, verify } from "../middleware/auth";
import { CommentService, PostService, TagService } from "../services";
import type { Bindings, Variables } from "../types/app";
import { ExtendedJWTPayload } from "../types/app";
import { parseMarkdown } from "../utils/markdown";

const posts = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 获取所有帖子
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
      <header class="mb-2 text-xl font-bold">发布新帖子</header>
      <form action="/posts" method="post" id="post-form">
        <div>
          <label for="title">标题</label>
          <input type="text" id="title" name="title" required />
        </div>
        <div>
          <label for="content">内容</label>
          <textarea
            id="content"
            name="content"
            required
            rows={20}
            placeholder="在此输入内容，支持 Markdown 格式..."
          ></textarea>
        </div>
        <div>
          <label for="tag">标签</label>
          <select id="tag" name="tag" required>
            <option value="">-- 选择标签 --</option>
            {tags.map((tag) => (
              <option value={tag.name}>{tag.name}</option>
            ))}
          </select>
        </div>
        <button type="submit">发布</button>
      </form>
    </article>,
    {
      title: "发布新帖子",
      user: user,
    }
  );
});

// 处理新帖子提交 - 需要登录（已修复：添加 user_id）
posts.post("/", jwtAuth, async (c) => {
  const formData = await c.req.formData();
  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim();
  const tag = (formData.get("tag") as string)?.trim();

  // 使用JWT中的用户信息
  const user = c.get("user");
  const author = user.username;
  const userId = user.id; // 获取用户ID

  if (!title || !content || !tag) {
    return c.render(
      <div>
        <h1>发布失败</h1>
        <p>标题和内容还有标签不能为空</p>
        <a href="/posts/new" className="button">
          返回
        </a>
      </div>,
      { title: "发布失败 - Hono BBS", user }
    );
  }

  // 解析 Markdown 内容为 HTML
  const parsedContent = parseMarkdown(content);

  const postService = PostService.getInstance(c.env.DB);
  const postId = await postService.createPost({
    title,
    content: parsedContent,
    rawContent: content, // 保存原始 Markdown
    author,
    tag,
    user_id: userId, // 关键修复：添加 user_id
  });

  return c.redirect(`/posts/${postId}`);
});

// 查看单个帖子（保持不变）
posts.get("/:id", async (c) => {
  // ... 原有代码 ...
});

// 编辑帖子页面 - 需要是作者或管理员
posts.get("/:id/edit", jwtAuth, async (c) => {
  // ... 原有代码 ...
});

// 处理帖子编辑 - 需要是作者或管理员
posts.post("/:id/edit", jwtAuth, async (c) => {
  // ... 原有代码 ...
});

// 删除帖子页面 - 需要是管理员
posts.get("/:id/delete", jwtAuth, async (c) => {
  // ... 原有代码 ...
});

// 处理帖子删除 - 需要是管理员
posts.post("/:id/delete", jwtAuth, adminOnly, async (c) => {
  // ... 原有代码 ...
});

// 添加评论 - 需要登录
posts.post("/:id/comment", jwtAuth, async (c) => {
  // ... 原有代码 ...
});

// 编辑评论页面 - 管理员可编辑任何评论，普通用户只能编辑自己的评论
posts.get("/:postId/comment/:commentId/edit", jwtAuth, async (c) => {
  // ... 原有代码 ...
});

// 处理评论编辑 - 管理员可编辑任何评论，普通用户只能编辑自己的评论
posts.post("/:postId/comment/:commentId/edit", jwtAuth, async (c) => {
  // ... 原有代码 ...
});

// 删除评论确认页面 - 仅管理员可用
posts.get(
  "/:postId/comment/:commentId/delete",
  jwtAuth,
  adminOnly,
  async (c) => {
    // ... 原有代码 ...
  }
);

// 处理评论删除 - 仅管理员可用
posts.post(
  "/:postId/comment/:commentId/delete",
  jwtAuth,
  adminOnly,
  async (c) => {
    // ... 原有代码 ...
  }
);

export { posts };