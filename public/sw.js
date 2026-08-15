// public/sw.js

const CACHE_NAME = 'media-cache-v1'

// 安装 Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

// 激活 Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// 拦截请求，缓存媒体文件
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  
  // 只缓存来自 GitHub 的图片/视频
  if (url.hostname.includes('raw.githubusercontent.com')) {
    const request = event.request
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            // 命中缓存，直接返回（极快）
            return cachedResponse
          }
          // 未命中，从网络获取并存入缓存
          return fetch(request).then((response) => {
            if (response.status === 200) {
              // 克隆响应并存入缓存
              const responseClone = response.clone()
              cache.put(request, responseClone)
            }
            return response
          })
        })
      })
    )
  }
})