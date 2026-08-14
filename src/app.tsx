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

// ========== 新增：导入新路由 ==========
import circles from './routes/api/circles'
import bottles from './routes/api/bottles'
import moods from './routes/api/moods'
import capsules from './routes/api/capsules'
import bottlePage from './routes/bottle'
import bottleSend from './routes/bottle/send'
import bottlePick from './routes/bottle/pick'
import moodPage from './routes/mood'
import capsulePage from './routes/capsule'
import capsuleNew from './routes/capsule/new'
import circlesPage from './routes/circles'
import circleDetail from './routes/circles/[id]'
import circleCreate from './routes/circles/create'

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

// ---------- CORS ----------
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

// ---------- 原有路由 ----------
app.route('/', index)
app.route('/posts', posts)
app.route('/user', user)
app.route('/tags', tags)
app.route('/profile', profile)
app.route('/api', upload)
app.route('/api/profile', profileApi)
app.route('/api/messages', messagesApi)

// ========== 新增：挂载新路由 ==========
// API 路由
app.route('/api/circles', circles)
app.route('/api/bottles', bottles)
app.route('/api/moods', moods)
app.route('/api/capsules', capsules)

// 页面路由
app.route('/bottle', bottlePage)
app.route('/bottle/send', bottleSend)
app.route('/bottle/pick', bottlePick)
app.route('/mood', moodPage)
app.route('/capsule', capsulePage)
app.route('/capsule/new', capsuleNew)
app.route('/circles', circlesPage)
app.route('/circles', circleDetail)
app.route('/circles/create', circleCreate)

export default app