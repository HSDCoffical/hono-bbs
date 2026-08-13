import * as crypto from 'crypto';
import { Hono } from "hono";
import { getCookie, setCookie } from 'hono/cookie';
import { generateToken, jwtAuth, verify } from '../middleware/auth';
import { UserService } from '../services';
import type { Bindings, Variables } from "../types/app";
import { ExtendedJWTPayload } from "../types/app";

const user = new Hono<{ Bindings: Bindings ,Variables: Variables}>()

// 注册页面
user.get('/reg', async (c) => {
  const token = getCookie(c, 'auth_token')
  let currentUser: ExtendedJWTPayload | null = null
  
  if (token) {
    try {
      const payload = await verify(token, c.env.JWT_SECRET) as ExtendedJWTPayload
      currentUser = payload
      return c.redirect('/')
    } catch (error) {
      // Token无效，忽略
    }
  }
  
  return c.render(
    <article>
      <header>用户注册</header>
      
      <form action="/user/reg" method="post">
        <label for="username">
          用户名
          <input type="text" id="username" name="username" placeholder="请输入用户名" required />
        </label>
        
        <label for="password">
          密码
          <input type="password" id="password" name="password" placeholder="请输入密码" required />
        </label>
        
        <label for="confirmPassword">
          确认密码
          <input type="password" id="confirmPassword" name="confirmPassword" placeholder="请再次输入密码" required />
        </label>
        
        <label for="email">
          电子邮箱
          <input type="email" id="email" name="email" placeholder="请输入电子邮箱" required />
        </label>
        
        <label for="bio">
          个人简介
          <textarea id="bio" name="bio" placeholder="请输入个人简介"></textarea>
        </label>
        
        <button type="submit">注册</button>
      </form>
      
      <p>已有账号？<a href="/user/login">登录</a></p>
    </article>,
    { 
      title: '用户注册 - 凉宫社区',
      user: currentUser
    }
  )
})

// 处理注册请求
user.post('/reg', async (c) => {
  const formData = await c.req.formData()
  const username = (formData.get('username') as string)?.trim()
  const password = (formData.get('password') as string)?.trim()
  const confirmPassword = (formData.get('confirmPassword') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()
  const bio = (formData.get('bio') as string)?.trim()
  
  if (!username || !password || !confirmPassword || !email) {
    return c.render(
      <div>
        <h1>错误</h1>
        <p>用户名、密码、确认密码和邮箱是必填的</p>
        <a href="/user/reg" class="button">返回</a>
      </div>,
      { title: '凉宫社区 - 错误' }
    )
  }
  
  if (password !== confirmPassword) {
    return c.render(
      <div>
        <h1>错误</h1>
        <p>密码和确认密码不一致</p>
        <a href="/user/reg" class="button">返回</a>
      </div>,
      { title: '凉宫社区 - 错误' }
    )
  }
  
  const userService = UserService.getInstance(c.env.DB)
  
  const existingUser = await userService.getUserByUsername(username)
  
  if (existingUser) {
    return c.render(
      <div>
        <h1>错误</h1>
        <p>用户名已存在</p>
        <a href="/user/reg" class="button">返回</a>
      </div>,
      { title: '凉宫社区 - 错误' }
    )
  }
  
  const emailHash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex')
  const avatarUrl = `https://www.gravatar.com/avatar/${emailHash}?d=identicon`
  
  await userService.createUser({
    username,
    password,
    email,
    bio: bio,
    avatar: avatarUrl
  })
  
  return c.render(
    <div>
      <h1>注册成功</h1>
      <p>您已成功注册，现在可以登录了</p>
      <a href="/user/login" class="button">去登录</a>
    </div>,
    { title: '凉宫社区 - 注册成功' }
  )
})

// 登录页面
user.get('/login', async (c) => {
  const token = getCookie(c, 'auth_token')
  let currentUser: ExtendedJWTPayload | null = null
  
  if (token) {
    try {
      const payload = await verify(token, c.env.JWT_SECRET) as ExtendedJWTPayload
      currentUser = payload
      return c.redirect('/')
    } catch (error) {
      // Token无效，忽略
    }
  }
  
  return c.render(
    <article>
      <header>用户登录</header>
      
      <form action="/user/login" method="post">
        <label for="username">
          用户名
          <input type="text" id="username" name="username" placeholder="请输入用户名" required />
        </label>
        
        <label for="password">
          密码
          <input type="password" id="password" name="password" placeholder="请输入密码" required />
        </label>
        
        <button type="submit">登录</button>
      </form>
      
      <p>没有账号？<a href="/user/reg">注册</a></p>
    </article>,
    { 
      title: '用户登录|欢迎！ - 凉宫社区',
      user: currentUser
    }
  )
})

// 处理登录请求
user.post('/login', async (c) => {
  const formData = await c.req.formData()
  const username = (formData.get('username') as string)?.trim()
  const password = (formData.get('password') as string)?.trim()
  
  if (!username || !password) {
    return c.render(
      <div>
        <h1>错误</h1>
        <p>用户名和密码都是必填的</p>
        <a href="/user/login" class="button">返回</a>
      </div>,
      { title: '凉宫社区 - 错误' }
    )
  }
  
  const userService = UserService.getInstance(c.env.DB)
  
  const user = await userService.validateUser(username, password)
  
  if (!user) {
    return c.render(
      <div>
        <h1>错误</h1>
        <p>用户名或密码不正确</p>
        <a href="/user/login" class="button">返回</a>
      </div>,
      { title: '凉宫社区 - 错误' }
    )
  }
  
  // 生成JWT令牌
  const token = await generateToken(user, c.env.JWT_SECRET)
  
  // 设置Cookie（保持登录状态）
  setCookie(c, 'auth_token', token, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'Lax'
  })
  
  // ===== 关键修改：跳转到官网并携带用户名 =====
  // 使用 encodeURIComponent 处理中文用户名
  const encodedUsername = encodeURIComponent(user.username);
  return c.redirect(`https://hsdc.dpdns.org?username=${encodedUsername}`);
})

// 退出登录
user.get('/logout', (c) => {
  setCookie(c, 'auth_token', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0
  })
  
  return c.redirect('/')
})

// 获取当前用户信息
user.get('/me', jwtAuth, async (c) => {
  const userData = c.get('user')
  const userService = UserService.getInstance(c.env.DB)
  const user = await userService.getUserById(userData.id)
  
  if (!user) {
    return c.json({ error: '用户不存在' }, 404)
  }
  
  const { password, ...userInfo } = user
  return c.json(userInfo)
})

// 更新用户信息
user.post('/update', jwtAuth, async (c) => {
  const userData = c.get('user')
  const formData = await c.req.formData()
  
  const userService = UserService.getInstance(c.env.DB)
  const user = await userService.getUserById(userData.id)
  
  if (!user) {
    return c.json({ error: '用户不存在' }, 404)
  }
  
  const updateData: any = {}
  
  if (formData.has('bio')) {
    updateData.bio = formData.get('bio') as string
  }
  
  if (formData.has('email')) {
    const email = formData.get('email') as string
    updateData.email = email
    
    const emailHash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex')
    updateData.avatar = `https://www.gravatar.com/avatar/${emailHash}?d=identicon`
  }
  
  if (formData.has('password')) {
    updateData.password = formData.get('password') as string
  }
  
  await userService.updateUser(userData.id, updateData)
  
  return c.json({ success: true })
})

export { user };