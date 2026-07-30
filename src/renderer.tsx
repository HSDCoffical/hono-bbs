import { jsxRenderer } from 'hono/jsx-renderer'
import { ExtendedJWTPayload } from './types';
import { generateClientScripts } from './utils/clientScripts';

// SVG图标组件（保持不变）
const HomeIcon = () => ( /* 同前，省略以节省篇幅 */ );
const TagIcon = () => ( /* 同前 */ );
const PostIcon = () => ( /* 同前 */ );
const UserIcon = () => ( /* 同前 */ );
const LoginIcon = () => ( /* 同前 */ );
const RegisterIcon = () => ( /* 同前 */ );
const LogoutIcon = () => ( /* 同前 */ );

interface HeaderProps {
  user?: ExtendedJWTPayload | null;
}

const Header = ({ user }: HeaderProps) => {
  const isLoggedIn = !!user;
  const isAdmin = user?.role === 'admin';

  return (
    <header style={{
      position: 'relative',
      overflow: 'hidden',
      backgroundImage: 'url(/static/01.jpg)',
      backgroundSize: '100% 100%',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      width: '100%',
      padding: '0.5rem 1rem', // 增加左右内边距
      boxSizing: 'border-box',
    }}>
      <nav style={{ position: 'relative', zIndex: 1 }}>
        <ul className="flex items-center space-x-2 flex-wrap" style={{ textShadow: '0 0 8px rgba(0,0,0,0.7)', margin: 0, padding: 0 }}>
          <li><strong style={{ color: 'white', whiteSpace: 'nowrap' }}>凉宫数据|社区中心</strong></li>
          <li>
            <a href="/" class="secondary flex items-center space-x-2" style={{ color: 'white' }}>
              <span class="flex items-center justify-center"><HomeIcon /></span>
              <span class="hidden md:inline-block">首页</span>
            </a>
          </li>
          <li>
            <a href="/tags" class="secondary flex items-center space-x-2" style={{ color: 'white' }}>
              <span class="flex items-center justify-center"><TagIcon /></span>
              <span class="hidden md:inline-block">标签</span>
            </a>
          </li>
          {isLoggedIn && (
            <>
              <li>
                <a href="/posts/new" class="secondary flex items-center space-x-2" style={{ color: 'white' }}>
                  <span class="flex items-center justify-center"><PostIcon /></span>
                  <span class="hidden md:inline-block">发布</span>
                </a>
              </li>
              <li>
                <a href={`/profile/${user.username}`} class="secondary flex items-center space-x-2" style={{ color: 'white' }}>
                  <span class="flex items-center justify-center"><UserIcon /></span>
                  <span class="hidden md:inline-block">{user.username}</span>
                </a>
              </li>
            </>
          )}
          {!isLoggedIn && (
            <>
              <li>
                <a href="/user/reg" class="secondary flex items-center space-x-2" style={{ color: 'white' }}>
                  <span class="flex items-center justify-center"><RegisterIcon /></span>
                  <span class="hidden md:inline-block">注册</span>
                </a>
              </li>
              <li>
                <a href="/user/login" class="secondary flex items-center space-x-2" style={{ color: 'white' }}>
                  <span class="flex items-center justify-center"><LoginIcon /></span>
                  <span class="hidden md:inline-block">登录</span>
                </a>
              </li>
            </>
          )}
          {isLoggedIn && (
            <li>
              <a href="/user/logout" class="secondary flex items-center space-x-2" style={{ color: 'white' }}>
                <span class="flex items-center justify-center"><LogoutIcon /></span>
                <span class="hidden md:inline-block">退出</span>
              </a>
            </li>
          )}
        </ul>
      </nav>
    </header>
  )
}

export const renderer = jsxRenderer(({ children, title, user }) => {
  return (
    <html lang="zh_CN">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <title>{title}</title>
        <link rel="stylesheet" href="/static/main.css?v=1.0.3" />
        <link rel="icon" href="/static/favicon.ico" />
        <script src="https://cdn.jsdelivr.net/npm/@unocss/runtime"></script>
        <script src="https://cdn.jsdelivr.net/npm/htmx.org@2.0.4/dist/htmx.min.js"></script>
      </head>
      <body un-cloak>
        {/* 标题栏放在 main 外面，全宽显示 */}
        <Header user={user} />
        <main class="container">
          {children}
        </main>
        <script src="/static/js/client.js"></script>
      </body>
    </html>
  )
})