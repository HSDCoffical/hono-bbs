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
  await commentService.deleteComment(commentId);
  return c.redirect(`/posts/${postId}`);
});

// ✅ 关键：导出 posts 路由
export default posts;