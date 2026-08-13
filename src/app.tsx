import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-pages'
import { cors } from 'hono/cors'
import { renderer } from './renderer'
import { index } from './routes/index'
import { posts } from './routes/posts'
import { user } from './routes/user'
import { tags } from './routes/tags'
import { profile } from './routes/profile'
import upload from './routes/api/upload'
import { profileApi } from './routes/api/profile'
import { messagesApi } from './routes/api/messages'
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

// ---------- CORS（支持大小写，允许官网跨域调用 API） ----------
app.use('*', cors({
  origin: (origin) => {
    // 如果 origin 为空（如 Postman），可以放行或根据需求决定
    if (!origin) return origin;
    // 允许的域名列表（不区分大小写）
    const allowed = ['https://hsdc.dpdns.org', 'https://HSDC.dpdns.org'];
    // 检查 origin 是否匹配（忽略大小写）
    if (allowed.some(o => o.toLowerCase() === origin.toLowerCase())) {
      return origin; // 返回请求的 origin，保证 CORS 头一致
    }
    return null; // 拒绝
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
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
app.route('/api/profile', profileApi)
app.route('/api/messages', messagesApi)

export default app