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

// ---------- CORS（明确允许两种大小写域名） ----------
app.use('*', cors({
  origin: ['https://hsdc.dpdns.org', 'https://HSDC.dpdns.org'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// ---------- 静态文件服务 ----------
app.use('/static/*', serveStatic())

// ---------- 渲染器中间件 ----------
app.get('*', renderer)
app.post('*', renderer)

// ---------- 路由 ----------
app.route('/', index)
app.route('/posts', posts)
app.route('/user', user)
app.route('/tags', tags)
app.route('/profile', profile)
app.route('/api', upload)
app.route('/api/profile', profileApi)
app.route('/api/messages', messagesApi)

export default app