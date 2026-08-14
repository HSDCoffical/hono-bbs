-- ============================================================
-- 原有表：用户、帖子、评论、标签、设置
-- ============================================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  email TEXT NOT NULL,
  email_hash TEXT,
  bio TEXT,
  avatar TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP DEFAULT (DATETIME('now', 'utc'))
);

-- 帖子表
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  raw_content TEXT,
  author TEXT NOT NULL,
  tag TEXT,
  comment_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT (DATETIME('now', 'utc')),
  FOREIGN KEY (author) REFERENCES users(username)
);

-- 评论表
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  raw_content TEXT NOT NULL,
  author TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT (DATETIME('now', 'utc')),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (author) REFERENCES users(username)
);

-- 标签表
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT (DATETIME('now', 'utc'))
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 原有触发器
-- ============================================================

-- 第一个注册用户自动成为管理员
CREATE TRIGGER IF NOT EXISTS make_first_user_admin
AFTER INSERT ON users
WHEN (SELECT COUNT(*) FROM users) = 1
BEGIN
  UPDATE users SET role = 'admin' WHERE id = NEW.id;
END;

-- 添加评论时更新帖子评论数
CREATE TRIGGER IF NOT EXISTS increment_post_comment_count
AFTER INSERT ON comments
BEGIN
    UPDATE posts 
    SET comment_count = comment_count + 1 
    WHERE id = NEW.post_id;
END;

-- 删除评论时更新帖子评论数
CREATE TRIGGER IF NOT EXISTS decrement_post_comment_count
AFTER DELETE ON comments
BEGIN
    UPDATE posts 
    SET comment_count = CASE WHEN comment_count > 0 THEN comment_count - 1 ELSE 0 END 
    WHERE id = OLD.post_id;
END;

-- 设置表更新时间触发器
CREATE TRIGGER IF NOT EXISTS update_settings_timestamp 
AFTER UPDATE ON settings
BEGIN
  UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================================
-- 默认配置
-- ============================================================

INSERT OR IGNORE INTO settings (key, value) VALUES 
  ('site_name', '{"value": "Hono BBS", "description": "网站名称"}'),
  ('enable_registration', '{"value": true, "description": "是否允许新用户注册"}'),
  ('enable_comments', '{"value": true, "description": "是否允许发表评论"}');

-- ============================================================
-- 新增：为 posts 表添加 circle_id 字段（圈子关联）
-- ============================================================
ALTER TABLE posts ADD COLUMN circle_id INTEGER REFERENCES circles(id);

-- ============================================================
-- 新增：圈子表
-- ============================================================
CREATE TABLE IF NOT EXISTS circles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📁',
  creator_id INTEGER NOT NULL,
  member_count INTEGER DEFAULT 1,
  post_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT (DATETIME('now', 'utc')),
  FOREIGN KEY (creator_id) REFERENCES users(id)
);

-- ============================================================
-- 新增：圈子成员表
-- ============================================================
CREATE TABLE IF NOT EXISTS circle_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  joined_at TIMESTAMP DEFAULT (DATETIME('now', 'utc')),
  FOREIGN KEY (circle_id) REFERENCES circles(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(circle_id, user_id)
);

-- ============================================================
-- 新增：漂流瓶表
-- ============================================================
CREATE TABLE IF NOT EXISTS bottles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_user_id INTEGER,
  content TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT 0,
  status TEXT DEFAULT 'drifting' CHECK (status IN ('drifting', 'picked', 'replied')),
  picked_by_user_id INTEGER,
  reply_content TEXT,
  created_at TIMESTAMP DEFAULT (DATETIME('now', 'utc')),
  picked_at TIMESTAMP,
  replied_at TIMESTAMP,
  FOREIGN KEY (sender_user_id) REFERENCES users(id),
  FOREIGN KEY (picked_by_user_id) REFERENCES users(id)
);

-- ============================================================
-- 新增：情绪记录表
-- ============================================================
CREATE TABLE IF NOT EXISTS moods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  session_id TEXT,
  mood_type TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT (DATETIME('now', 'utc')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================================
-- 新增：时光信表
-- ============================================================
CREATE TABLE IF NOT EXISTS time_capsules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  unlock_at TIMESTAMP NOT NULL,
  status TEXT DEFAULT 'locked' CHECK (status IN ('locked', 'unlocked', 'read')),
  created_at TIMESTAMP DEFAULT (DATETIME('now', 'utc')),
  read_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================================
-- 新增：索引（提高查询性能）
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_posts_circle_id ON posts(circle_id);
CREATE INDEX IF NOT EXISTS idx_bottles_status ON bottles(status);
CREATE INDEX IF NOT EXISTS idx_bottles_sender ON bottles(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_moods_created_at ON moods(created_at);
CREATE INDEX IF NOT EXISTS idx_capsules_user_status ON time_capsules(user_id, status);
CREATE INDEX IF NOT EXISTS idx_circle_members_circle ON circle_members(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_members_user ON circle_members(user_id);