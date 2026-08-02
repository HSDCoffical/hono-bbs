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

// 主初始化函数
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
}

// 页面加载完成后执行初始化
document.addEventListener('DOMContentLoaded', initApp);