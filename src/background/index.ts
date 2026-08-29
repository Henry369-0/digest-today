// service worker：v1 刻意保持很薄。
// 快捷键 Alt+Shift+S 走 _execute_action（浏览器自动打开 popup），无需这里处理。
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // 首次安装直接带用户去设置页完成端点配置
    void chrome.runtime.openOptionsPage();
  }
});
