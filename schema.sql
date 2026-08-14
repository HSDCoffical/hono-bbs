-- ============================================================
-- 1. 为 posts 表添加 circle_id 字段（关联圈子）
-- ============================================================
-- 检查 column 是否存在，D1 的 ALTER TABLE 不支持 IF NOT EXISTS，所以我们先尝试添加，
-- 如果已存在会报错，可以忽略。但稳妥方式是用条件判断（但 D1 不支持），所以我们采用
-- 先查询再决定，但在迁移脚本中，我们默认执行 ADD COLUMN，如果失败则忽略。
-- 建议手动确认一下是否已有 circle_id 列。
ALTER TABLE posts ADD COLUMN circle_id INTEGER REFERENCES circles(id);

-- ============================================================
-- 2. 创建圈子表
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
-- 3. 创建圈子成员表
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
-- 4. 创建漂流瓶表
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
-- 5. 创建情绪记录表
-- ============================================================
CREATE TABLE IF NOT EXISTS moods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  session_id TEXT,    -- 游客模式使用
  mood_type TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT (DATETIME('now', 'utc')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================================
-- 6. 创建时光信表
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
-- 7. 新增索引（提高查询性能）
-- ============================================================
-- 帖子按圈子查询
CREATE INDEX IF NOT EXISTS idx_posts_circle_id ON posts(circle_id);
-- 漂流瓶状态和随机捞取
CREATE INDEX IF NOT EXISTS idx_bottles_status ON bottles(status);
CREATE INDEX IF NOT EXISTS idx_bottles_sender ON bottles(sender_user_id);
-- 情绪按日期
CREATE INDEX IF NOT EXISTS idx_moods_created_at ON moods(created_at);
-- 时光信按用户和状态
CREATE INDEX IF NOT EXISTS idx_capsules_user_status ON time_capsules(user_id, status);
-- 圈子成员查询
CREATE INDEX IF NOT EXISTS idx_circle_members_circle ON circle_members(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_members_user ON circle_members(user_id);

-- ============================================================
-- 8. 可选：为已有的 posts 设置默认圈子（比如 ID=1 的“默认”圈子）
-- 如果还没有圈子，可以先创建一个默认圈子，再更新 posts 的 circle_id
-- 但这里先不自动执行，留待管理员手动创建圈子后再更新。
-- ============================================================