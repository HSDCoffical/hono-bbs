import { D1Database } from '@cloudflare/workers-types'
import { Post } from '../types'

export class PostService {
  private static instance: PostService | null = null;
  
  // 单例模式实现
  static getInstance(db: D1Database): PostService {
    if (!PostService.instance) {
      PostService.instance = new PostService(db);
    }
    return PostService.instance;
  }

  constructor(private db: D1Database) {}

  async getAllPosts(): Promise<Post[]> {
    const { results } = await this.db.prepare(
      `SELECT id, title, content, raw_content as rawContent, author, tag, 
              comment_count, created_at, file_url, file_type, file_size 
       FROM posts ORDER BY created_at DESC`
    ).all<Post>()
    return results
  }

  async getPostsByTag(tag: string): Promise<Post[]> {
    const { results } = await this.db.prepare(
      `SELECT id, title, content, raw_content as rawContent, author, tag, 
              comment_count, created_at, file_url, file_type, file_size 
       FROM posts WHERE tag = ? ORDER BY created_at DESC`
    ).bind(tag).all<Post>()
    return results
  }

  async getPostById(id: number): Promise<Post | null> {
    const post = await this.db.prepare(
      `SELECT id, title, content, raw_content as rawContent, author, tag, 
              comment_count, created_at, file_url, file_type, file_size 
       FROM posts WHERE id = ?`
    ).bind(id).first<Post>()
    return post
  }

  async getPostsByAuthor(author: string): Promise<Post[]> {
    const { results } = await this.db.prepare(
      `SELECT id, title, content, raw_content as rawContent, author, tag, 
              comment_count, created_at, file_url, file_type, file_size 
       FROM posts WHERE author = ? ORDER BY created_at DESC`
    ).bind(author).all<Post>()
    return results
  }

  async createPost(post: Omit<Post, 'id' | 'created_at' | 'comment_count'>): Promise<number> {
    // 支持 file_url, file_type, file_size 字段
    const result = await this.db.prepare(
      `INSERT INTO posts (title, content, raw_content, author, tag, comment_count, 
                          file_url, file_type, file_size) 
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?) RETURNING id`
    ).bind(
      post.title,
      post.content,
      post.rawContent ?? null,   // 改为 ?? null
      post.author,
      post.tag ?? null,
      post.file_url ?? null,
      post.file_type ?? null,
      post.file_size ?? null
    ).first<{ id: number }>()
    return result?.id || 0
  }

  async updatePost(id: number, post: Partial<Omit<Post, 'id' | 'created_at' | 'comment_count'>>): Promise<boolean> {
    // 构建动态更新语句，支持所有字段
    const allowedKeys = ['title', 'content', 'rawContent', 'author', 'tag', 'file_url', 'file_type', 'file_size'];
    const fields = Object.keys(post)
      .filter(key => allowedKeys.includes(key))
      .map(key => {
        if (key === 'rawContent') return 'raw_content = ?';
        return `${key} = ?`;
      });
    
    if (fields.length === 0) return false;
    
    // ★★★ 关键修复：将所有值用 ?? null 处理，防止 undefined 传入 D1 ★★★
    const values = fields.map(field => {
      // field 可能是 'title = ?' 或 'raw_content = ?' 等
      const key = field.split(' ')[0]; // 提取字段名（如 'title' 或 'raw_content'）
      // 将数据库字段名映射回 post 对象的键名
      let objKey = key;
      if (key === 'raw_content') objKey = 'rawContent';
      // @ts-ignore
      const rawValue = post[objKey];
      return rawValue ?? null;   // 强制转为 null
    });
    values.push(id);
    
    const result = await this.db.prepare(
      `UPDATE posts SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...values).run()
    
    return result.success
  }

  async deletePost(id: number): Promise<boolean> {
    // First delete all comments associated with this post
    await this.db.prepare(
      'DELETE FROM comments WHERE post_id = ?'
    ).bind(id).run()
    
    // Then delete the post
    const result = await this.db.prepare(
      'DELETE FROM posts WHERE id = ?'
    ).bind(id).run()
    
    return result.success
  }
}