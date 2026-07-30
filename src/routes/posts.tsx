import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { adminOnly, jwtAuth, verify } from "../middleware/auth";
import { CommentService, PostService, TagService, UserService } from "../services"; // 导入 UserService
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

// 处理新帖子提交 - 需要登录（已修复：通过用户名查询 user_id）
posts.post("/", jwtAuth, async (c) => {
  const formData = await c.req.formData();
  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim();
  const tag = (formData.get("tag") as string)?.trim();

  // 使用JWT中的用户名
  const user = c.get("user");
  const author = user.username;

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

  // 通过用户名查询用户 ID
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
  const postId = await postService.createPost({
    title,
    content: parsedContent,
    rawContent: content,
    author,
    tag,
    user_id: userId, // 使用从数据库查到的 ID
  });

  return c.redirect(`/posts/${postId}`);
});

// 以下所有路由保持不变（省略，与原文件相同）
// 包括查看帖子、编辑、删除、评论等...

export { posts };