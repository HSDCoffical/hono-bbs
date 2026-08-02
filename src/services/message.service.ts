import { D1Database } from '@cloudflare/workers-types';

export interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  is_read: boolean;
  created_at: string;
  sender_name?: string;
}

export class MessageService {
  private static instance: MessageService | null = null;
  private db: D1Database;

  private constructor(db: D1Database) {
    this.db = db;
  }

  static getInstance(db: D1Database): MessageService {
    if (!MessageService.instance) {
      MessageService.instance = new MessageService(db);
    }
    return MessageService.instance;
  }

  async sendMessage(senderId: number, receiverId: number, content: string): Promise<number> {
    const result = await this.db.prepare(
      'INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?) RETURNING id'
    ).bind(senderId, receiverId, content).first<{ id: number }>();
    return result?.id || 0;
  }

  async getMessagesForUser(userId: number): Promise<(Message & { sender_name: string })[]> {
    const { results } = await this.db.prepare(
      `SELECT m.*, u.username as sender_name
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.receiver_id = ?
       ORDER BY m.created_at DESC`
    ).bind(userId).all<Message & { sender_name: string }>();
    return results;
  }

  async markAsRead(messageId: number): Promise<boolean> {
    const result = await this.db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').bind(messageId).run();
    return result.success;
  }

  async getUnreadCount(userId: number): Promise<number> {
    const result = await this.db.prepare(
      'SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = 0'
    ).bind(userId).first<{ count: number }>();
    return result?.count || 0;
  }

  async sendSystemMessage(content: string): Promise<void> {
    const { results } = await this.db.prepare('SELECT id FROM users').all<{ id: number }>();
    for (const user of results) {
      await this.sendMessage(0, user.id, content);
    }
  }

  async getAllUsers(): Promise<{ id: number; username: string }[]> {
    const { results } = await this.db.prepare('SELECT id, username FROM users ORDER BY username').all();
    return results;
  }
}