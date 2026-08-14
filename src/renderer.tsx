import { jsxRenderer } from 'hono/jsx-renderer'
import { ExtendedJWTPayload } from './types';
import { generateClientScripts } from './utils/clientScripts';

// SVG图标组件
const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    <polyline points="9 22 9 12 15 12 15 22"></polyline>
  </svg>
);

const CircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
  </svg>
);

const BottleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 2h4"></path>
    <path d="M12 14v4"></path>
    <path d="M8 6h8"></path>
    <path d="M10 6v2a2 2 0 0 0 4 0V6"></path>
    <path d="M7 6c0-1.1.9-2 2-2h6a2 2 0 0 1 2 2v11a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V6Z"></path>
  </svg>
);

const MoodIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
    <line x1="9" y1="9" x2="9.01" y2="9"></line>
    <line x1="15" y1="9" x2="15.01" y2="9"></line>
  </svg>
);

const TimeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const LoginIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
    <polyline points="10 17 15 12 10 7"></polyline>
    <line x1="15" y1="12" x2="3" y2="12"></line>
  </svg>
);

const RegisterIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <line x1="19" y1="8" x2="19" y2="14"></line>
    <line x1="16" y1="11" x2="22" y2="11"></line>
  </svg>
);

const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
    <polyline points="16 17 21 12 16 7"></polyline>
    <line x1="21" y1="12" x2="9" y2="12"></line>
  </svg>
);

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
        <ul className="flex items-center space-x-2 flex-wrap" style={{ textShadow: '0 0 8px rgba(0,0,0,0.7)', margin: 0, padding: 0 }}>
          <li><strong style={{ color: 'white', whiteSpace: 'nowrap', fontSize: '1.1rem' }}>凉宫社区</strong></li>
          <li>
            <a href="/posts" class="secondary flex items-center space-x-2" style={{ color: 'white', fontSize: '0.9rem' }}>
              <span class="flex items-center justify-center"><HomeIcon /></span>
              <span class="hidden md:inline-block">首页</span>
            </a>
          </li>
          <li>
            <a href="/circles" class="secondary flex items-center space-x-2" style={{ color: 'white', fontSize: '0.9rem' }}>
              <span class="flex items-center justify-center"><CircleIcon /></span>
              <span class="hidden md:inline-block">圈子</span>
            </a>
          </li>
          <li>
            <a href="/bottle" class="secondary flex items-center space-x-2" style={{ color: 'white', fontSize: '0.9rem' }}>
              <span class="flex items-center justify-center"><BottleIcon /></span>
              <span class="hidden md:inline-block">漂流瓶</span>
            </a>
          </li>
          <li>
            <a href="/mood" class="secondary flex items-center space-x-2" style={{ color: 'white', fontSize: '0.9rem' }}>
              <span class="flex items-center justify-center"><MoodIcon /></span>
              <span class="hidden md:inline-block">情绪</span>
            </a>
          </li>
          <li>
            <a href="/capsule" class="secondary flex items-center space-x-2" style={{ color: 'white', fontSize: '0.9rem' }}>
              <span class="flex items-center justify-center"><TimeIcon /></span>
              <span class="hidden md:inline-block">时光信</span>
            </a>
          </li>
          {isLoggedIn && (
            <>
              <li>
                <a href={`/profile/${user.username}`} class="secondary flex items-center space-x-2" style={{ color: 'white', fontSize: '0.9rem' }}>
                  <span class="flex items-center justify-center"><UserIcon /></span>
                  <span class="hidden md:inline-block">{user.username}</span>
                </a>
              </li>
            </>
          )}
          {!isLoggedIn && (
            <>
              <li>
                <a href="/user/reg" class="secondary flex items-center space-x-2" style={{ color: 'white', fontSize: '0.9rem' }}>
                  <span class="flex items-center justify-center"><RegisterIcon /></span>
                  <span class="hidden md:inline-block">注册</span>
                </a>
              </li>
              <li>
                <a href="/user/login" class="secondary flex items-center space-x-2" style={{ color: 'white', fontSize: '0.9rem' }}>
                  <span class="flex items-center justify-center"><LoginIcon /></span>
                  <span class="hidden md:inline-block">登录</span>
                </a>
              </li>
            </>
          )}
          {isLoggedIn && (
            <li>
              <a href="/user/logout" class="secondary flex items-center space-x-2" style={{ color: 'white', fontSize: '0.9rem' }}>
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