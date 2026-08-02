import { D1Database } from '@cloudflare/workers-types';

export class ProfileService {
  private static instance: ProfileService | null = null;
  private db: D1Database;

  private constructor(db: D1Database) {
    this.db = db;
  }

  static getInstance(db: D1Database): ProfileService {
    if (!ProfileService.instance) {
      ProfileService.instance = new ProfileService(db);
    }
    return ProfileService.instance;
  }

  async getProfile(userId: number) {
    return this.db.prepare(
      'SELECT user_id, bio, avatar, website, location, updated_at FROM profiles WHERE user_id = ?'
    ).bind(userId).first();
  }

  async createProfile(userId: number) {
    await this.db.prepare('INSERT INTO profiles (user_id) VALUES (?)').bind(userId).run();
  }

  async updateProfile(userId: number, data: { bio?: string; avatar?: string; website?: string; location?: string }) {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.bio !== undefined) { fields.push('bio = ?'); values.push(data.bio); }
    if (data.avatar !== undefined) { fields.push('avatar = ?'); values.push(data.avatar); }
    if (data.website !== undefined) { fields.push('website = ?'); values.push(data.website); }
    if (data.location !== undefined) { fields.push('location = ?'); values.push(data.location); }
    if (fields.length === 0) return false;
    values.push(userId);
    const result = await this.db.prepare(
      `UPDATE profiles SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`
    ).bind(...values).run();
    return result.success;
  }
}