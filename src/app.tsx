import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-pages'
import { renderer } from './renderer'
import { index } from './routes/index'
import { posts } from './routes/posts'
import { user } from './routes/user'
import { tags } from './routes/tags'
import { profile } from './routes/profile'
import upload from './routes/api/upload'
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

export default app