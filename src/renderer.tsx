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
      padding: '0.5rem 1rem',
      boxSizing: 'border-box',
    }}>
      <nav style={{ 
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'nowrap',              // 强制一行显示
        gap: '0.5rem',
        overflowX: 'auto',               // 如果屏幕太窄允许水平滚动
      }}>
        {/* Logo */}
        <a href="/" style={{ 
          fontWeight: 'bold', 
          fontSize: '1rem', 
          textDecoration: 'none', 
          color: 'white', 
          textShadow: '0 0 8px rgba(0,0,0,0.7)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>☁️ 凉宫社区</a>

        {/* 导航链接 */}
        <div style={{ 
          display: 'flex', 
          gap: '0.4rem', 
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <a href="/posts" style={{ 
            color: 'white', 
            fontSize: '0.8rem', 
            textDecoration: 'none', 
            opacity: 0.85,
            textShadow: '0 0 8px rgba(0,0,0,0.7)',
            whiteSpace: 'nowrap'
          }}>首页</a>
          <a href="/circles" style={{ 
            color: 'white', 
            fontSize: '0.8rem', 
            textDecoration: 'none', 
            opacity: 0.85,
            textShadow: '0 0 8px rgba(0,0,0,0.7)',
            whiteSpace: 'nowrap'
          }}>圈子</a>
          <a href="/bottle" style={{ 
            color: 'white', 
            fontSize: '0.8rem', 
            textDecoration: 'none', 
            opacity: 0.85,
            textShadow: '0 0 8px rgba(0,0,0,0.7)',
            whiteSpace: 'nowrap'
          }}>漂流瓶</a>
          <a href="/mood" style={{ 
            color: 'white', 
            fontSize: '0.8rem', 
            textDecoration: 'none', 
            opacity: 0.85,
            textShadow: '0 0 8px rgba(0,0,0,0.7)',
            whiteSpace: 'nowrap'
          }}>情绪</a>
          <a href="/capsule" style={{ 
            color: 'white', 
            fontSize: '0.8rem', 
            textDecoration: 'none', 
            opacity: 0.85,
            textShadow: '0 0 8px rgba(0,0,0,0.7)',
            whiteSpace: 'nowrap'
          }}>时光信</a>
        </div>

        {/* 用户区域 */}
        <div style={{ 
          display: 'flex', 
          gap: '0.4rem', 
          alignItems: 'center',
          flexShrink: 0,
        }}>
          {isLoggedIn ? (
            <>
              <a href={`/profile/${user.username}`} style={{ 
                color: 'white', 
                fontSize: '0.8rem', 
                textDecoration: 'none', 
                opacity: 0.85,
                textShadow: '0 0 8px rgba(0,0,0,0.7)',
                whiteSpace: 'nowrap'
              }}>{user.username}</a>
              <a href="/user/logout" style={{ 
                color: 'rgba(255,255,255,0.6)', 
                fontSize: '0.75rem', 
                textDecoration: 'none', 
                textShadow: '0 0 8px rgba(0,0,0,0.7)',
                whiteSpace: 'nowrap'
              }}>退出</a>
            </>
          ) : (
            <>
              <a href="/user/reg" style={{ 
                color: 'white', 
                fontSize: '0.8rem', 
                textDecoration: 'none', 
                opacity: 0.85,
                textShadow: '0 0 8px rgba(0,0,0,0.7)',
                whiteSpace: 'nowrap'
              }}>注册</a>
              <a href="/user/login" style={{ 
                color: 'white', 
                fontSize: '0.8rem', 
                textDecoration: 'none', 
                opacity: 0.85,
                textShadow: '0 0 8px rgba(0,0,0,0.7)',
                whiteSpace: 'nowrap'
              }}>登录</a>
            </>
          )}
        </div>
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