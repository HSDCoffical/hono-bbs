import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-pages'
import { cors } from 'hono/cors'   // ← 新增 CORS
import { renderer } from './renderer'
import { index } from './routes/index'
import { posts } from './routes/posts'
import { user } from './routes/user'
import { tags } from './routes/tags'
import { profile } from './routes/profile'
import upload from './routes/api/upload'
import { profileApi } from './routes/api/profile'     // ← 新增
import { messagesApi } from './routes/api/messages'   // ← 新增
import { D1Database } from '@cloudflare/workers-types'

export type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  ASSETS?: { fetch: (request: Request) => Promise<Response> }
}

const app = new Hono<{ Bindings: Bindings }>()
app.onError((err, c) => {
  return c.text(`Error: ${err.message}\n\nStack: ${err.stack}`, 500);
});

// ---------- CORS（允许 AstroWind 官网调用 API） ----------
app.use('*', cors({
  origin: 'https://HSDC.dpdns.org', // 替换为你的 AstroWind 实际域名（如 https://astrowind.pages.dev）
  credentials: true,
}))

// ---------- 静态文件服务 ----------
app.use('/static/*', serveStatic())

// ---------- 渲染器中间件（用于 Hono 的 JSX 渲染） ----------
app.get('*', renderer)
app.post('*', renderer)

// ---------- 具体业务路由 ----------
app.route('/', index)
app.route('/posts', posts)
app.route('/user', user)
app.route('/tags', tags)
app.route('/profile', profile)
app.route('/api', upload)

// ---------- 新增用户中心 API 路由 ----------
app.route('/api/profile', profileApi)   // 个人资料更新
app.route('/api/messages', messagesApi) // 消息查询、发送等

export default app