//public/static/preview.js
文件.addEventListener('DOMContentLoaded', 功能() {
  Const FileInput=文件.getElementById('文件');
  如果 (FileInput) {
    FileInput.addEventListener('更改', 功能(e) {
      Const 预览=文件.getElementById('预览');
      Const 文件=e.目标.文件[0];
      如果 (!文件) { 预览.innerHTML=''; 返回; }
      Const URL=URL.createObjectURL(文件);
      如果 (文件.类型.startswith('图像/')) {
        预览.innerHTML='<img src="'+URL+'"style="最大宽度：300px；最大高度：300px；边框半径：8px；边框：1px实心#ddd；"/>';
      } 其他 如果 (文件.类型.startswith('视频/')) {
        预览.innerHTML='<视频src="'+URL+'"控件样式="最大宽度：300px；最大高度：300px；边框半径：8px；边框：1px实心#ddd；"></video>";
      }
    });
  }
});
