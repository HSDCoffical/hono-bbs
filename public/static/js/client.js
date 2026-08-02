/**
 * Timestamp Converter
 * 
 * This script finds all elements with the data-timestamp attribute
 * and converts their UTC timestamps to local time in the format yyyy/MM/dd HH:mm:ss
 */

// Extract the timestamp conversion logic into a separate function
function convertTimestamps() {
  // Find all elements with data-timestamp attribute
  const timestampElements = document.querySelectorAll('[data-timestamp]');
  
  // Format function to ensure numbers have leading zeros when needed
  const formatNumber = (num) => num.toString().padStart(2, '0');
  
  // Process each element
  timestampElements.forEach(element => {
    const utcTimestamp = element.getAttribute('data-timestamp');
    
    if (utcTimestamp) {
      // Create a Date object from the UTC timestamp
      // Add 'Z' to indicate UTC if it's not already there
      const date = new Date(utcTimestamp.endsWith('Z') ? utcTimestamp : utcTimestamp + 'Z');
      
      // Format the date as yyyy/MM/dd HH:mm:ss
      const year = date.getFullYear();
      const month = formatNumber(date.getMonth() + 1); // getMonth() is 0-indexed
      const day = formatNumber(date.getDate());
      const hours = formatNumber(date.getHours());
      const minutes = formatNumber(date.getMinutes());
      const seconds = formatNumber(date.getSeconds());
      
      const formattedDate = `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
      
      // Update the element's text content
      element.textContent = formattedDate;
    }
  });
}

// 主初始化函数（合并所有 DOMContentLoaded 逻辑）
function initApp() {
  // 1. 时间戳转换
  convertTimestamps();
  
  // 2. HTMX 内容交换后重新转换
  document.body.addEventListener('htmx:afterSwap', function() {
    convertTimestamps();
  });
  
  // 3. 防重复提交功能
  const formConfig = {
    'post-form': {
      loadingText: '发布中...',
      originalText: '发布'
    },
    'comment-form': {
      loadingText: '提交中...',
      originalText: '提交评论'
    },
    'reg-form': {
      loadingText: '注册中...',
      originalText: '注册'
    },
    'login-form': {
      loadingText: '登录中...',
      originalText: '登录'
    },
    'edit-post-form': {
      loadingText: '更新中...',
      originalText: '更新'
    },
    'edit-comment-form': {
      loadingText: '更新中...',
      originalText: '更新'
    }
  };
  
  document.querySelectorAll('form').forEach(form => {
    const formId = form.id;
    const submitButton = form.querySelector('button[type="submit"]');
    if (!submitButton) return;
    
    const config = formConfig[formId] || {
      loadingText: '提交中...',
      originalText: submitButton.textContent || '提交'
    };
    const originalText = config.originalText;
    
    form.addEventListener('submit', function(e) {
      if (submitButton.disabled) {
        e.preventDefault();
        return;
      }
      submitButton.disabled = true;
      submitButton.textContent = config.loadingText;
      
      setTimeout(() => {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }, 10000);
    });
  });

  // 4. 长按评论弹出删除悬浮窗（新增功能）
  let longPressTimer = null;
  // 创建悬浮窗（只创建一次）
  const popup = document.createElement('div');
  popup.id = 'comment-delete-popup';
  popup.style.cssText = `
    position: fixed;
    background: white;
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 12px 20px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 9999;
    display: none;
    min-width: 120px;
  `;
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '删除此评论';
  deleteBtn.style.cssText = `
    background: #e53e3e;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;
  deleteBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    const commentId = popup.dataset.commentId;
    const postId = popup.dataset.postId;
    if (commentId && postId) {
      fetch(`/posts/${postId}/comment/${commentId}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }).then(() => {
        window.location.reload();
      }).catch(() => {
        alert('删除失败，请重试');
      });
    }
    popup.style.display = 'none';
  });
  popup.appendChild(deleteBtn);
  document.body.appendChild(popup);

  // 长按监听（touch 事件）
  document.addEventListener('touchstart', function(e) {
    const target = e.target.closest('[data-comment-id]');
    if (!target) return;
    const commentId = target.dataset.commentId;
    const postId = target.dataset.postId;
    popup.dataset.commentId = commentId;
    popup.dataset.postId = postId;

    longPressTimer = setTimeout(() => {
      const touch = e.touches[0];
      popup.style.left = (touch.clientX - 60) + 'px';
      popup.style.top = (touch.clientY - 20) + 'px';
      popup.style.display = 'block';
    }, 500);
  });

  document.addEventListener('touchmove', function() {
    clearTimeout(longPressTimer);
  });

  document.addEventListener('touchend', function() {
    clearTimeout(longPressTimer);
  });

  // 点击其他区域隐藏悬浮窗
  document.addEventListener('click', function(e) {
    if (!popup.contains(e.target)) {
      popup.style.display = 'none';
    }
  });

  // 支持鼠标右键（PC 调试）
  document.addEventListener('contextmenu', function(e) {
    const target = e.target.closest('[data-comment-id]');
    if (!target) return;
    e.preventDefault();
    const commentId = target.dataset.commentId;
    const postId = target.dataset.postId;
    popup.dataset.commentId = commentId;
    popup.dataset.postId = postId;
    popup.style.left = e.clientX - 60 + 'px';
    popup.style.top = e.clientY - 20 + 'px';
    popup.style.display = 'block';
  });
}

// 页面加载完成后执行初始化
document.addEventListener('DOMContentLoaded', initApp);