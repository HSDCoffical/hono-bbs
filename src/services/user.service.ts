import { D1Database } from '@cloudflare/workers-types'
import { User } from '../types'
import * as bcrypt from 'bcryptjs'
import * as crypto from 'crypto'

export class UserService {
  private static instance: UserService | null = null;
  
  // 单例模式实现
  static getInstance(db: D1Database): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService(db);
    }
    return UserService.instance;
  }

  constructor(private db: D1Database) {}

  async getUserByUsername(username: string): Promise<User | null> {
    // 显式列出所有字段，包含 badge
    const user = await this.db.prepare(
      `SELECT id, username, password, email, email_hash, bio, avatar, role, created_at, badge 
       FROM users WHERE username = ?`
    ).bind(username).first<User>()
    return user
  }

  async getUserById(id: number): Promise<User | null> {
    const user = await this.db.prepare(
      `SELECT id, username, password, email, email_hash, bio, avatar, role, created_at, badge 
       FROM users WHERE id = ?`
    ).bind(id).first<User>()
    return user
  }

  async createUser(user: Omit<User, 'id' | 'created_at' | 'role' | 'email_hash' | 'badge'>): Promise<number> {
    // 对密码进行哈希处理
    const hashedPassword = await bcrypt.hash(user.password, 10)
    
    // 生成email的MD5哈希值
    const emailHash = crypto.createHash('md5').update(user.email.toLowerCase().trim()).digest('hex')
    
    // 插入时 badge 默认为 NULL
    const result = await this.db.prepare(
      `INSERT INTO users (username, password, email, email_hash, bio, avatar, role, badge) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
    ).bind(
      user.username, 
      hashedPassword, 
      user.email,
      emailHash,
      user.bio || null, 
      emailHash,          // avatar 用 email_hash 作为默认头像
      'user',             // 默认角色
      null                // badge 默认为 NULL
    ).first<{ id: number }>()
    
    return result?.id || 0
  }

  async updateUser(id: number, user: Partial<Omit<User, 'id' | 'created_at'>>): Promise<boolean> {
    // 如果更新包含密码，对其进行哈希处理
    if (user.password) {
      user.password = await bcrypt.hash(user.password, 10)
    }
    
    // 如果更新包含email，更新email_hash
    if (user.email) {
      const emailHash = crypto.createHash('md5').update(user.email.toLowerCase().trim()).digest('hex')
      user.email_hash = emailHash
    }
    
    const fields = Object.keys(user).map(key => `${key} = ?`).join(', ')
    const values = Object.values(user)
    
    const result = await this.db.prepare(
      `UPDATE users SET ${fields} WHERE id = ?`
    ).bind(...values, id).run()
    
    return result.success
  }

  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username)
    
    if (!user) {
      return null
    }
    
    const isValid = await bcrypt.compare(password, user.password)
    
    if (!isValid) {
      return null
    }
    
    return user
  }

  async getUsersByUsernames(usernames: string[]): Promise<User[]> {
    if (usernames.length === 0) {
      return [];
    }
    
    // 创建占位符 (?, ?, ?)
    const placeholders = usernames.map(() => '?').join(', ');
    
    const { results } = await this.db.prepare(
      `SELECT id, username, password, email, email_hash, bio, avatar, role, created_at, badge 
       FROM users WHERE username IN (${placeholders})`
    ).bind(...usernames).all<User>();
    
    return results;
  }
}