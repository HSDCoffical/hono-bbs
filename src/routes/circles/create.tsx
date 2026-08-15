import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import type { Bindings, Variables } from "../../types";

const circleCreate = new Hono<{ Bindings: Bindings; Variables: Variables }>();

circleCreate.get("/", async (c) => {
  const token = getCookie(c, "auth_token");
  if (!token) {
    return c.redirect("/auth/login");
  }

  const payload = await verify(token, c.env.JWT_SECRET) as any;
  const db = c.env.DB;
  const user = await db.prepare('SELECT id, username FROM users WHERE id = ?').bind(payload.id).first();

  return c.render(
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>创建圈子 - 凉宫社区</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.min.css" />
        <style>{`
          .modal-overlay {
            display: none;
            position: fixed;
            inset: 0;
            z-index: 9999;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(4px);
            align-items: center;
            justify-content: center;
            padding: 1rem;
          }
          .modal-overlay.active {
            display: flex;
          }
          .modal-content {
            background: white;
            border-radius: 16px;
            max-width: 600px;
            width: 100%;
            max-height: 90vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 24px 48px rgba(0, 0, 0, 0.3);
          }
          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem 1.5rem;
            border-bottom: 1px solid #eee;
          }
          .modal-header h3 {
            margin: 0;
            font-size: 1.1rem;
          }
          .modal-header button {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: #999;
            padding: 0 0.5rem;
          }
          .modal-header button:hover {
            color: #333;
          }
          .modal-body {
            padding: 1rem;
            overflow: hidden;
            flex: 1;
            min-height: 300px;
          }
          .modal-body img {
            max-width: 100%;
            display: block;
          }
          .modal-footer {
            padding: 1rem 1.5rem;
            border-top: 1px solid #eee;
            display: flex;
            gap: 0.75rem;
            justify-content: flex-end;
          }
          .modal-footer button {
            padding: 0.5rem 1.5rem;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            font-size: 0.9rem;
          }
          .btn-cancel {
            background: #f0f0f0;
            color: #666;
          }
          .btn-cancel:hover {
            background: #e0e0e0;
          }
          .btn-confirm {
            background: #4a90d9;
            color: white;
          }
          .btn-confirm:hover {
            background: #3a7bc8;
          }
          .crop-preview {
            margin-top: 0.5rem;
            display: none;
            align-items: center;
            gap: 0.75rem;
            padding: 0.5rem;
            background: #f5f5f5;
            border-radius: 8px;
          }
          .crop-preview.show {
            display: flex;
          }
          .crop-preview img {
            width: 48px;
            height: 48px;
            border-radius: 8px;
            object-fit: cover;
            border: 1px solid #ddd;
          }
          .crop-preview span {
            font-size: 0.85rem;
            color: #666;
          }
          .cropper-container {
            max-height: 50vh;
          }
          @media (max-width: 600px) {
            .modal-content {
              max-width: 100%;
              margin: 0.5rem;
              max-height: 95vh;
            }
            .modal-body {
              min-height: 200px;
              padding: 0.5rem;
            }
          }
        `}</style>
      </head>
      <body>
        <main class="container" style={{ padding: '1rem 0' }}>
          <div style={{ maxWidth: '500px', margin: '2rem auto' }}>
            <h1>➕ 创建圈子</h1>
            <p style={{ color: '#666' }}>创建一个属于你的小天地</p>

            <form
              id="circleForm"
              method="POST"
              action="/circles/create"
              encType="multipart/form-data"
            >
              <div>
                <label htmlFor="name">圈子名称 *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  maxLength={30}
                  required
                  placeholder="2-30个字符"
                />
              </div>

              <div style={{ marginTop: '1rem' }}>
                <label htmlFor="icon">图标 *</label>
                <input
                  type="file"
                  id="icon"
                  name="icon"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                  required
                  style={{ display: 'block', marginTop: '0.3rem' }}
                />
                <small style={{ color: '#999', fontSize: '0.75rem' }}>
                  支持 PNG、JPG、WebP、SVG、GIF，最大 10MB，将自动裁剪为 1:1 正方形
                </small>
                <div id="cropPreview" class="crop-preview">
                  <img id="previewImage" src="" alt="裁剪预览" />
                  <span id="previewFileName"></span>
                  <button
                    type="button"
                    id="recropBtn"
                    style={{
                      marginLeft: 'auto',
                      padding: '0.2rem 0.8rem',
                      fontSize: '0.75rem',
                      background: '#f0f0f0',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    重新裁剪
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <label htmlFor="description">描述 *</label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  required
                  placeholder="这个圈子是关于什么的？"
                  style={{ resize: 'vertical', width: '100%' }}
                />
              </div>

              <button type="submit" role="button" style={{ marginTop: '1rem' }}>
                🚀 创建圈子
              </button>
            </form>
          </div>
        </main>

        {/* ===== 裁剪模态框 ===== */}
        <div id="cropModal" class="modal-overlay">
          <div class="modal-content">
            <div class="modal-header">
              <h3>✂️ 裁剪图标</h3>
              <button type="button" id="closeModalBtn">×</button>
            </div>
            <div class="modal-body">
              <div style={{ position: 'relative' }}>
                <img id="cropImage" src="" alt="裁剪原图" style={{ maxWidth: '100%', display: 'block' }} />
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#999', textAlign: 'center' }}>
                拖动裁剪框选择区域 · 固定 1:1 比例
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-cancel" id="cancelCropBtn">取消</button>
              <button type="button" class="btn-confirm" id="confirmCropBtn">✅ 确认裁剪</button>
            </div>
          </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.min.js"></script>

        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              const fileInput = document.getElementById('icon');
              const cropModal = document.getElementById('cropModal');
              const cropImage = document.getElementById('cropImage');
              const confirmBtn = document.getElementById('confirmCropBtn');
              const cancelBtn = document.getElementById('cancelCropBtn');
              const closeBtn = document.getElementById('closeModalBtn');
              const previewContainer = document.getElementById('cropPreview');
              const previewImg = document.getElementById('previewImage');
              const previewFileName = document.getElementById('previewFileName');
              const recropBtn = document.getElementById('recropBtn');

              let cropper = null;
              let currentFile = null;
              let croppedFile = null;

              function openCropModal(file) {
                currentFile = file;
                const reader = new FileReader();
                reader.onload = function(e) {
                  cropImage.src = e.target.result;
                  cropModal.classList.add('active');
                  cropImage.onload = function() {
                    if (cropper) {
                      cropper.destroy();
                      cropper = null;
                    }
                    cropper = new Cropper(cropImage, {
                      aspectRatio: 1,
                      viewMode: 1,
                      autoCropArea: 1,
                      dragMode: 'move',
                      guides: true,
                      center: true,
                      highlight: false,
                      cropBoxMovable: true,
                      cropBoxResizable: true,
                      responsive: true,
                      restore: false,
                    });
                    setTimeout(function() {
                      if (cropper) {
                        cropper.setCropBoxData({
                          left: 0,
                          top: 0,
                          width: Math.min(cropImage.naturalWidth, cropImage.naturalHeight) || 200,
                          height: Math.min(cropImage.naturalWidth, cropImage.naturalHeight) || 200,
                        });
                      }
                    }, 100);
                  };
                  if (cropImage.complete) {
                    cropImage.onload();
                  }
                };
                reader.readAsDataURL(file);
              }

              function closeCropModal() {
                cropModal.classList.remove('active');
                if (cropper) {
                  cropper.destroy();
                  cropper = null;
                }
                cropImage.src = '';
                currentFile = null;
              }

              function confirmCrop() {
                if (!cropper) return;
                const canvas = cropper.getCroppedCanvas({
                  width: 512,
                  height: 512,
                  imageSmoothingQuality: 'high',
                });
                if (!canvas) {
                  alert('裁剪失败，请重试');
                  return;
                }
                const mimeType = currentFile.type || 'image/png';
                canvas.toBlob(function(blob) {
                  if (!blob) {
                    alert('裁剪失败，请重试');
                    return;
                  }
                  const fileName = currentFile.name.replace(/\\.[^.]+$/, '') + '_cropped.png';
                  croppedFile = new File([blob], fileName, { type: 'image/png' });

                  const dataTransfer = new DataTransfer();
                  dataTransfer.items.add(croppedFile);
                  fileInput.files = dataTransfer.files;

                  const previewReader = new FileReader();
                  previewReader.onload = function(e) {
                    previewImg.src = e.target.result;
                    previewContainer.classList.add('show');
                    previewFileName.textContent = fileName + ' (' + (blob.size / 1024).toFixed(0) + 'KB)';
                  };
                  previewReader.readAsDataURL(croppedFile);

                  closeCropModal();
                }, 'image/png', 0.92);
              }

              fileInput.addEventListener('change', function(e) {
                const file = this.files && this.files[0];
                if (!file) return;

                const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'];
                if (!allowedTypes.includes(file.type)) {
                  alert('不支持的文件格式，请上传 PNG、JPG、WebP、SVG 或 GIF');
                  this.value = '';
                  return;
                }

                if (file.size > 10 * 1024 * 1024) {
                  alert('文件大小不能超过 10MB');
                  this.value = '';
                  return;
                }

                openCropModal(file);
              });

              confirmBtn.addEventListener('click', confirmCrop);

              cancelBtn.addEventListener('click', function() {
                fileInput.value = '';
                croppedFile = null;
                previewContainer.classList.remove('show');
                closeCropModal();
              });

              closeBtn.addEventListener('click', function() {
                fileInput.value = '';
                croppedFile = null;
                previewContainer.classList.remove('show');
                closeCropModal();
              });

              cropModal.addEventListener('click', function(e) {
                if (e.target === this) {
                  fileInput.value = '';
                  croppedFile = null;
                  previewContainer.classList.remove('show');
                  closeCropModal();
                }
              });

              recropBtn.addEventListener('click', function() {
                if (!croppedFile) return;
                openCropModal(croppedFile);
                previewContainer.classList.remove('show');
                fileInput.value = '';
                croppedFile = null;
              });

              document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && cropModal.classList.contains('active')) {
                  fileInput.value = '';
                  croppedFile = null;
                  previewContainer.classList.remove('show');
                  closeCropModal();
                }
              });

              document.getElementById('circleForm').addEventListener('submit', function(e) {
                if (!fileInput.files || fileInput.files.length === 0) {
                  e.preventDefault();
                  alert('请上传并裁剪图标');
                }
              });

              console.log('✅ 裁剪功能已初始化');
            })();
          `
        }} />

      </body>
    </html>,
    {
      title: "创建圈子 - 凉宫社区",
      user: user,
    }
  );
});

// ===== POST 处理 =====
circleCreate.post("/", async (c) => {
  const token = getCookie(c, "auth_token");
  if (!token) {
    return c.json({ error: '请先登录' }, 401);
  }

  const payload = await verify(token, c.env.JWT_SECRET) as any;
  const db = c.env.DB;

  const formData = await c.req.formData();
  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const iconFile = formData.get('icon') as File | null;

  // 验证：名称
  if (!name || name.length < 2) {
    return c.html('<p style="color:red;">圈子名称至少2个字符</p><a href="/circles/create">返回</a>');
  }
  if (name.length > 30) {
    return c.html('<p style="color:red;">圈子名称不能超过30个字符</p><a href="/circles/create">返回</a>');
  }

  // 验证：描述（必填）
  if (!description || description.trim().length < 1) {
    return c.html('<p style="color:red;">请填写圈子描述</p><a href="/circles/create">返回</a>');
  }

  // 验证：图标（必填）
  if (!iconFile || iconFile.size === 0) {
    return c.html('<p style="color:red;">请上传并裁剪圈子图标</p><a href="/circles/create">返回</a>');
  }

  // 验证文件类型
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'];
  if (!allowedTypes.includes(iconFile.type)) {
    return c.html('<p style="color:red;">不支持的文件格式，请上传 PNG、JPG、WebP、SVG 或 GIF</p><a href="/circles/create">返回</a>');
  }

  // 验证文件大小（10MB）
  if (iconFile.size > 10 * 1024 * 1024) {
    return c.html('<p style="color:red;">文件大小不能超过 10MB</p><a href="/circles/create">返回</a>');
  }

  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  // 检查是否已存在同名圈子
  const existing = await db.prepare('SELECT id FROM circles WHERE slug = ?').bind(slug).first();
  if (existing) {
    return c.html(`<p style="color:red;">圈子名称已存在，请换一个</p><a href="/circles/create">返回</a>`);
  }

  try {
    // ===== 1. 上传图标到 GitHub =====
    const GITHUB_TOKEN = c.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
      return c.html('<p style="color:red;">服务器未配置 GitHub Token，请联系管理员</p><a href="/circles/create">返回</a>');
    }

    const repo = 'HSDCoffical/workshop';
    const uploadDir = 'workshop';

    const arrayBuffer = await iconFile.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    const timestamp = Date.now();
    const safeName = iconFile.name.replace(/[^a-zA-Z0-9.\u4e00-\u9fa5]/g, '_');
    const filename = `${timestamp}-${safeName}`;
    const path = uploadDir ? `${uploadDir}/${filename}` : filename;

    const githubUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
    const uploadResp = await fetch(githubUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Hono-BBS-App/1.0'
      },
      body: JSON.stringify({
        message: `上传圈子图标: ${iconFile.name}`,
        content: base64,
      }),
    });

    if (!uploadResp.ok) {
      let detail = await uploadResp.text();
      try {
        const json = JSON.parse(detail);
        detail = json.message || json.errors || detail;
      } catch (_) {}
      return c.html(`<p style="color:red;">图标上传失败: ${uploadResp.status} - ${detail}</p><a href="/circles/create">返回</a>`);
    }

    const iconUrl = `https://raw.githubusercontent.com/${repo}/main/${path}`;

    // ===== 2. 创建圈子 =====
    await db.prepare(`
      INSERT INTO circles (name, slug, description, icon, creator_id)
      VALUES (?, ?, ?, ?, ?)
    `).bind(name, slug, description.trim(), iconUrl, payload.id).run();

    const circle = await db.prepare('SELECT id FROM circles WHERE slug = ?').bind(slug).first();

    if (!circle || !circle.id) {
      return c.html('<p style="color:red;">创建失败，未找到新创建的圈子</p><a href="/circles/create">返回</a>');
    }

    const circleId = circle.id;

    await db.prepare(`
      INSERT INTO circle_members (circle_id, user_id, role)
      VALUES (?, ?, 'admin')
    `).bind(circleId, payload.id).run();

    return c.redirect(`/circles/${circleId}`);

  } catch (error: any) {
    console.error('创建圈子错误:', error);
    return c.html(`<p style="color:red;">创建失败：${error.message || '未知错误'}</p><a href="/circles/create">返回</a>`);
  }
});

export { circleCreate };