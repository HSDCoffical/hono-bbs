import { jsxRenderer } from 'hono/jsx-renderer'
import { ExtendedJWTPayload } from './types';

// ============================================================
// 顶部导航已完全注释，由各页面自己接管（index.tsx 已实现）
// ============================================================

// interface HeaderProps {
//   user?: ExtendedJWTPayload | null;
// }

// const Header = ({ user }: HeaderProps) => {
//   const isLoggedIn = !!user;
//   return (
//     <header style={{
//       position: 'relative',
//       overflow: 'hidden',
//       backgroundImage: 'url(/static/01.jpg)',
//       backgroundSize: 'cover',
//       backgroundPosition: 'center',
//       backgroundRepeat: 'no-repeat',
//       width: '100%',
//       padding: '0.5rem 1rem',
//       boxSizing: 'border-box',
//     }}>
//       <nav style={{
//         position: 'relative',
//         zIndex: 1,
//         display: 'flex',
//         justifyContent: 'space-between',
//         alignItems: 'center',
//         flexWrap: 'nowrap',
//         gap: '0.4rem',
//         overflowX: 'auto',
//         WebkitOverflowScrolling: 'touch',
//         paddingBottom: '0.2rem',
//       }}>
//         <a href="/" style={{
//           fontWeight: 'bold',
//           fontSize: '1rem',
//           textDecoration: 'none',
//           color: 'white',
//           textShadow: '0 0 8px rgba(0,0,0,0.7)',
//           whiteSpace: 'nowrap',
//           flexShrink: 0,
//           padding: '0.2rem 0.4rem',
//         }}>☁️ 凉宫社区</a>
//
//         <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexShrink: 0 }}>
//           {['首页', '圈子', '漂流瓶', '情绪', '时光信'].map((label, idx) => {
//             const href = ['/posts', '/circles', '/bottle', '/mood', '/capsule'][idx];
//             return (
//               <a key={label} href={href} style={{
//                 color: 'white',
//                 fontSize: '0.8rem',
//                 textDecoration: 'none',
//                 textShadow: '0 0 8px rgba(0,0,0,0.7)',
//                 whiteSpace: 'nowrap',
//                 padding: '0.2rem 0.6rem',
//                 border: '1px solid rgba(255,255,255,0.35)',
//                 borderRadius: '4px',
//                 background: 'rgba(255,255,255,0.08)',
//                 backdropFilter: 'blur(4px)',
//                 WebkitBackdropFilter: 'blur(4px)',
//                 display: 'inline-block',
//               }}>{label}</a>
//             );
//           })}
//         </div>
//
//         <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexShrink: 0 }}>
//           {isLoggedIn ? (
//             <>
//               <a href={`/profile/${user.username}`} style={{
//                 color: 'white',
//                 fontSize: '0.8rem',
//                 textDecoration: 'none',
//                 textShadow: '0 0 8px rgba(0,0,0,0.7)',
//                 whiteSpace: 'nowrap',
//                 padding: '0.2rem 0.6rem',
//                 border: '1px solid rgba(255,255,255,0.35)',
//                 borderRadius: '4px',
//                 background: 'rgba(255,255,255,0.08)',
//                 backdropFilter: 'blur(4px)',
//                 WebkitBackdropFilter: 'blur(4px)',
//                 display: 'inline-block',
//               }}>{user.username}</a>
//               <a href="/user/logout" style={{
//                 color: 'rgba(255,255,255,0.7)',
//                 fontSize: '0.7rem',
//                 textDecoration: 'none',
//                 textShadow: '0 0 8px rgba(0,0,0,0.7)',
//                 whiteSpace: 'nowrap',
//                 padding: '0.2rem 0.5rem',
//                 border: '1px solid rgba(255,255,255,0.2)',
//                 borderRadius: '4px',
//                 background: 'rgba(255,255,255,0.05)',
//                 backdropFilter: 'blur(4px)',
//                 WebkitBackdropFilter: 'blur(4px)',
//                 display: 'inline-block',
//               }}>退出</a>
//             </>
//           ) : (
//             <>
//               <a href="/user/reg" style={{
//                 color: 'white',
//                 fontSize: '0.8rem',
//                 textDecoration: 'none',
//                 textShadow: '0 0 8px rgba(0,0,0,0.7)',
//                 whiteSpace: 'nowrap',
//                 padding: '0.2rem 0.6rem',
//                 border: '1px solid rgba(255,255,255,0.35)',
//                 borderRadius: '4px',
//                 background: 'rgba(255,255,255,0.08)',
//                 backdropFilter: 'blur(4px)',
//                 WebkitBackdropFilter: 'blur(4px)',
//                 display: 'inline-block',
//               }}>注册</a>
//               <a href="/user/login" style={{
//                 color: 'white',
//                 fontSize: '0.8rem',
//                 textDecoration: 'none',
//                 textShadow: '0 0 8px rgba(0,0,0,0.7)',
//                 whiteSpace: 'nowrap',
//                 padding: '0.2rem 0.6rem',
//                 border: '1px solid rgba(255,255,255,0.35)',
//                 borderRadius: '4px',
//                 background: 'rgba(255,255,255,0.08)',
//                 backdropFilter: 'blur(4px)',
//                 WebkitBackdropFilter: 'blur(4px)',
//                 display: 'inline-block',
//               }}>登录</a>
//             </>
//           )}
//         </div>
//       </nav>
//     </header>
//   )
// }

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
        {/* ===== 顶部导航完全由各页面自己渲染 ===== */}
        {/* <Header user={user} /> */}

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

        {/* ===== Service Worker 注册（缓存媒体文件） ===== */}
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.register('/sw.js')
                .then(function(reg) {
                  console.log('✅ Service Worker 注册成功')
                })
                .catch(function(err) {
                  console.log('⚠️ Service Worker 注册失败:', err)
                })
            }
          `
        }} />

      </body>
    </html>
  )
})