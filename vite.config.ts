import build from '@hono/vite-build/cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { defineConfig } from 'vite'
import * as sass from 'sass'
import fs from 'fs'
import path from 'path'
import type { ViteDevServer, Plugin } from 'vite'

// 预处理 SCSS 文件
function compileSass() {
  const inputFile = path.resolve(__dirname, 'src/styles/main.scss')
  const outputDir = path.resolve(__dirname, 'public/static')
  const outputFile = path.join(outputDir, 'main.css')
  
  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  try {
    // 编译 SCSS
    const result = sass.compile(inputFile, {
      style: 'compressed',
      loadPaths: [path.resolve(__dirname, 'node_modules')],
      quietDeps: true
    })
    
    // 写入文件
    fs.writeFileSync(outputFile, result.css)
    console.log('SCSS 编译完成，CSS 文件已生成在 public/static/main.css')
    return true
  } catch (error) {
    console.error('SCSS 编译错误:', error)
    return false
  }
}

// 在构建开始前编译 SCSS
compileSass()

// 创建 SCSS 监听器插件
const scssWatcherPlugin = (): Plugin => {
  return {
    name: 'vite-plugin-scss-watcher',
    apply: 'serve' as const,
    configureServer(server: ViteDevServer) {
      const scssGlob = path.resolve(__dirname, 'src/styles/**/*.scss')
      
      server.httpServer?.once('listening', () => {
        console.log('添加 SCSS 文件监听器:', scssGlob)
        const watcher = server.watcher
        const normalizedPath = scssGlob.replace(/\\/g, '/')
        watcher.add(normalizedPath)
        watcher.on('change', (changedPath) => {
          if (changedPath.endsWith('.scss')) {
            console.log(`SCSS 文件变化: ${changedPath}`)
            if (compileSass()) {
              server.ws.send({
                type: 'full-reload'
              })
            }
          }
        })
      })
    }
  }
}

// 创建构建插件，确保在构建时也编译 SCSS
const scssBuildPlugin = (): Plugin => {
  return {
    name: 'vite-plugin-scss-builder',
    apply: 'build',
    buildStart() {
      console.log('构建开始，编译 SCSS...')
      compileSass()
    },
    writeBundle() {
      const srcFile = path.resolve(__dirname, 'public/static/main.css')
      const destDir = path.resolve(__dirname, 'dist/static')
      const destFile = path.join(destDir, 'main.css')
      
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true })
      }
      
      if (fs.existsSync(srcFile)) {
        fs.copyFileSync(srcFile, destFile)
        console.log(`CSS 文件已复制到 ${destFile}`)
      } else {
        console.error(`源 CSS 文件不存在: ${srcFile}`)
      }
    }
  }
}

// ===== 新增：复制 sw.js 到 dist 目录 =====
const copySwPlugin = (): Plugin => {
  return {
    name: 'vite-plugin-copy-sw',
    apply: 'build',
    writeBundle() {
      const srcFile = path.resolve(__dirname, 'public/sw.js')
      const destFile = path.resolve(__dirname, 'dist/sw.js')
      
      if (fs.existsSync(srcFile)) {
        // 确保 dist 目录存在
        if (!fs.existsSync(path.resolve(__dirname, 'dist'))) {
          fs.mkdirSync(path.resolve(__dirname, 'dist'), { recursive: true })
        }
        fs.copyFileSync(srcFile, destFile)
        console.log(`✅ sw.js 已复制到 ${destFile}`)
      } else {
        console.warn(`⚠️ sw.js 不存在: ${srcFile}，请确保 public/sw.js 文件存在`)
      }
    }
  }
}

// ===== 新增：复制 _headers 到 dist 目录 =====
const copyHeadersPlugin = (): Plugin => {
  return {
    name: 'vite-plugin-copy-headers',
    apply: 'build',
    writeBundle() {
      const srcFile = path.resolve(__dirname, '_headers')
      const destFile = path.resolve(__dirname, 'dist/_headers')
      
      if (fs.existsSync(srcFile)) {
        if (!fs.existsSync(path.resolve(__dirname, 'dist'))) {
          fs.mkdirSync(path.resolve(__dirname, 'dist'), { recursive: true })
        }
        fs.copyFileSync(srcFile, destFile)
        console.log(`✅ _headers 已复制到 ${destFile}`)
      } else {
        console.warn(`⚠️ _headers 不存在: ${srcFile}，请确保根目录有 _headers 文件`)
      }
    }
  }
}

export default defineConfig({
  plugins: [
    scssWatcherPlugin(),
    scssBuildPlugin(),
    // 新增：复制 sw.js 到 dist
    copySwPlugin(),
    // 新增：复制 _headers 到 dist
    copyHeadersPlugin(),
    devServer({      
      entry: 'src/app.tsx',
      adapter
    }),
    build({
      entry: 'src/app.tsx'
    }),
  ],
  
  server: {
    watch: {
      usePolling: true,
      interval: 100
    }
  }
})