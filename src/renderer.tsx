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
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <a href="/" style={{ fontWeight: 'bold', fontSize: '1.2rem', textDecoration: 'none', color: 'white', textShadow: '0 0 8px rgba(0,0,0,0.7)' }}>☁️ 凉宫社区</a>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <a href="/posts" role="button" class="outline" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem', color: 'white', borderColor: 'rgba(255,255,255,0.5)', textShadow: '0 0 8px rgba(0,0,0,0.7)' }}>首页</a>
          <a href="/circles" role="button" class="outline" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem', color: 'white', borderColor: 'rgba(255,255,255,0.5)', textShadow: '0 0 8px rgba(0,0,0,0.7)' }}>圈子</a>
          <a href="/bottle" role="button" class="outline" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem', color: 'white', borderColor: 'rgba(255,255,255,0.5)', textShadow: '0 0 8px rgba(0,0,0,0.7)' }}>漂流瓶</a>
          <a href="/mood" role="button" class="outline" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem', color: 'white', borderColor: 'rgba(255,255,255,0.5)', textShadow: '0 0 8px rgba(0,0,0,0.7)' }}>情绪</a>
          <a href="/capsule" role="button" class="outline" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem', color: 'white', borderColor: 'rgba(255,255,255,0.5)', textShadow: '0 0 8px rgba(0,0,0,0.7)' }}>时光信</a>
          {isLoggedIn ? (
            <>
              <a href={`/profile/${user.username}`} role="button" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem', color: 'white', textShadow: '0 0 8px rgba(0,0,0,0.7)' }}>{user.username}</a>
              <a href="/user/logout" role="button" class="outline" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.3)', textShadow: '0 0 8px rgba(0,0,0,0.7)' }}>退出</a>
            </>
          ) : (
            <>
              <a href="/user/reg" role="button" class="outline" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem', color: 'white', borderColor: 'rgba(255,255,255,0.5)', textShadow: '0 0 8px rgba(0,0,0,0.7)' }}>注册</a>
              <a href="/user/login" role="button" class="outline" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem', color: 'white', borderColor: 'rgba(255,255,255,0.5)', textShadow: '0 0 8px rgba(0,0,0,0.7)' }}>登录</a>
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