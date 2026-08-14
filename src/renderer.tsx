import { jsxRenderer } from 'hono/jsx-renderer'
import { ExtendedJWTPayload } from './types';

interface HeaderProps {
  user?: ExtendedJWTPayload | null;
}

const Header = ({ user }: HeaderProps) => {
  const isLoggedIn = !!user;

  return (
    <header style={{
      position: 'relative',
      overflow: 'hidden',
      backgroundImage: 'url(/static/01.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'top',
      backgroundRepeat: 'no-repeat',
      width: '100%',
      padding: '0.5rem 1rem',
      boxSizing: 'border-box',
    }}>
      <nav style={{ position: 'relative', zIndex: 1 }}>
        <ul className="flex items-center space-x-3 flex-wrap" style={{ 
          textShadow: '0 0 8px rgba(0,0,0,0.7)', 
          margin: 0, 
          padding: 0,
          listStyle: 'none'
        }}>
          <li><strong style={{ color: 'white', whiteSpace: 'nowrap', fontSize: '1.1rem' }}>凉宫社区</strong></li>
          <li><a href="/posts" class="secondary" style={{ color: 'white', fontSize: '0.85rem', textDecoration: 'none' }}>首页</a></li>
          <li><a href="/circles" class="secondary" style={{ color: 'white', fontSize: '0.85rem', textDecoration: 'none' }}>圈子</a></li>
          <li><a href="/bottle" class="secondary" style={{ color: 'white', fontSize: '0.85rem', textDecoration: 'none' }}>漂流瓶</a></li>
          <li><a href="/mood" class="secondary" style={{ color: 'white', fontSize: '0.85rem', textDecoration: 'none' }}>情绪</a></li>
          <li><a href="/capsule" class="secondary" style={{ color: 'white', fontSize: '0.85rem', textDecoration: 'none' }}>时光信</a></li>
          {isLoggedIn ? (
            <>
              <li><span style={{ color: 'white', fontSize: '0.85rem' }}>|</span></li>
              <li><a href={`/profile/${user.username}`} class="secondary" style={{ color: 'white', fontSize: '0.85rem', textDecoration: 'none' }}>{user.username}</a></li>
              <li><a href="/user/logout" class="secondary" style={{ color: 'white', fontSize: '0.8rem', textDecoration: 'none' }}>退出</a></li>
            </>
          ) : (
            <>
              <li><span style={{ color: 'white', fontSize: '0.85rem' }}>|</span></li>
              <li><a href="/user/reg" class="secondary" style={{ color: 'white', fontSize: '0.85rem', textDecoration: 'none' }}>注册</a></li>
              <li><a href="/user/login" class="secondary" style={{ color: 'white', fontSize: '0.85rem', textDecoration: 'none' }}>登录</a></li>
            </>
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
        <Header user={user} />
        <div style={{
          backgroundImage: 'url(/static/02.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          width: '100%',
          minHeight: 'calc(100vh - 80px)',
          padding: '0.5rem 0',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
        }}>
          <div style={{
            width: '96%',
            maxWidth: '1400px',
            margin: '0 auto',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            backgroundColor: 'rgba(255,255,255,0.5)',
            border: '1px solid rgba(255,255,255,0.4)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            borderRadius: '16px',
            padding: '1.5rem',
            minHeight: 'calc(100vh - 180px)',
          }}>
            {children}
          </div>
        </div>
        <script src="/static/js/client.js"></script>
      </body>
    </html>
  )
})