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
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      width: '100%',
      padding: '0.75rem 1.5rem',
      boxSizing: 'border-box',
    }}>
      {/* 毛玻璃覆盖层 */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        background: 'rgba(0,0,0,0.25)',
        zIndex: 0,
      }}></div>
      
      <nav style={{ position: 'relative', zIndex: 1 }}>
        <ul style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          margin: 0,
          padding: 0,
          listStyle: 'none',
          flexWrap: 'wrap',
        }}>
          <li style={{ fontWeight: 600, fontSize: '1rem', color: 'white', letterSpacing: '0.5px' }}>凉宫社区</li>
          <li><a href="/posts" style={{ color: 'white', fontSize: '0.9rem', textDecoration: 'none', opacity: 0.85 }}>首页</a></li>
          <li><a href="/circles" style={{ color: 'white', fontSize: '0.9rem', textDecoration: 'none', opacity: 0.85 }}>圈子</a></li>
          <li><a href="/bottle" style={{ color: 'white', fontSize: '0.9rem', textDecoration: 'none', opacity: 0.85 }}>漂流瓶</a></li>
          <li><a href="/mood" style={{ color: 'white', fontSize: '0.9rem', textDecoration: 'none', opacity: 0.85 }}>情绪</a></li>
          <li><a href="/capsule" style={{ color: 'white', fontSize: '0.9rem', textDecoration: 'none', opacity: 0.85 }}>时光信</a></li>
          {isLoggedIn ? (
            <li style={{ marginLeft: 'auto' }}>
              <a href={`/profile/${user.username}`} style={{ color: 'white', fontSize: '0.9rem', textDecoration: 'none', opacity: 0.85 }}>{user.username}</a>
            </li>
          ) : (
            <li style={{ marginLeft: 'auto' }}>
              <a href="/user/login" style={{ color: 'white', fontSize: '0.9rem', textDecoration: 'none', opacity: 0.85 }}>登录</a>
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