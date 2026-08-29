// E2E 验收用本地 mock：模拟 OpenAI 兼容端点（端口 11434，正好匹配扩展的「本地 Ollama」预设）
// 用法：node scripts/mock-llm.mjs [good|bad|slow]
//   good（默认）：返回规范摘要 JSON —— 验证 M2 正常链路 + M3 卡片
//   bad        ：返回带闲聊+坏 JSON —— 验证三级容错降级卡片
//   slow       ：延迟 6 秒 —— 验证骨架屏/超时文案
// 另提供 GET /article：一篇带导航/推荐位噪音的中文文章，喂给 Readability 做真实抽取。
import { createServer } from 'node:http';

const mode = process.argv[2] ?? 'good';
const PORT = 11434;

const ARTICLE = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>慢速阅读运动：为什么我们重新开始摘抄 - 城市读库</title>
<meta name="description" content="当信息流速超过理解速率，一小群读者开始退回到纸和笔。">
</head><body>
<nav><a href="/">首页</a><a href="/weekly">周刊</a><a href="/topics">专题</a>
<a href="/about">关于我们</a><a href="/join">加入会员</a><input placeholder="搜索文章"></nav>
<header><h1>慢速阅读运动：为什么我们重新开始摘抄</h1>
<p class="byline">文 / 林一 · 城市读库 · 2026 年 8 月</p></header>
<article>
<p>过去一年，「阅读焦虑」成了社交网络上的高频词。收藏夹越来越厚，读完的越来越少；
信息流速早已超过理解速率。于是有一小群读者做了一件看起来非常复古的事：
重新开始摘抄，用纸和笔。</p>
<p>这轮慢速阅读运动没有统一的宣言，但有一个共同的动作：读到哪里觉得重要，就抄下来，
并在旁边写一句自己的话。参与者说，抄写的那一刻，注意力第一次真正落在了句子上。</p>
<p>认知科学对此有一个朴素的解释：生成效应。自己动笔转述过的内容，比划线收藏过的内容
记得牢得多。划线是一种错觉式的占有，摘抄则是诚实的理解测试——抄不下来的句子，
多半是没读懂的句子。</p>
<p>城市读库的读者访谈里，一位坚持摘抄两年的外科医生说，他抄笔记的速度逼着他放弃了几十本
「值得收藏」的书，只留下十几本「值得重读」的书。摘抄的本质不是保存，是筛选。</p>
<p>运动发起者们并不反对工具。事实上，好几位发起者同时维护着数字卡片盒。他们的共识是：
工具可以快，理解必须慢。收藏一键即可，但真正的占有只发生在你把它写出来的那几分钟。</p>
<p>如果你也想试试，发起者的建议简单得可疑：一支笔，一个本子，每天三行，坚持两周。
两周之后，你会发现自己的收藏夹 开始变得挑剔——这大概就是这场运动全部的目的。</p>
</article>
<aside><h3>相关阅读</h3><ul><li><a href="/a1">一年读 100 本书的骗局</a></li>
<li><a href="/a2">卡片盒笔记法入门</a></li><li><a href="/a3">为什么电子书没有取代纸书</a></li></ul></aside>
<section class="comments"><h3>评论</h3><p>网友甲：抄了三天，手酸，但真的记得住。</p>
<p>网友乙：建议加上「别抄到手机备忘录里」。</p></section>
<footer>© 城市读库 · 沪ICP备xxxx号 · 联系我们 · 隐私政策 · 广告合作</footer>
</body></html>`;

const GOOD_SUMMARY = JSON.stringify({
  tldr: '摘抄是对抗碎片化阅读最朴素的工具：抄写逼你筛选，真正的占有只发生在动笔那一刻。',
  points: [
    '信息流速超过理解速率，收藏夹变厚而读完的变少',
    '生成效应：动笔转述比划线收藏记得牢，抄不下来多半是没读懂',
    '外科医生靠摘抄把「值得收藏」的书筛成「值得重读」的十几本',
    '运动共识：工具可以快，理解必须慢；每天三行坚持两周',
  ],
  verdict: 'must-read',
  keywords: ['慢速阅读', '摘抄', '注意力'],
  bestLine: '摘抄的本质不是保存，是筛选。',
});

const BAD_REPLY = `好的，这是您要的摘要！以下是JSON：
{"tldr": "摘抄是对抗碎片化阅读的方法", "points": ["生成效应让抄写记得牢", "摘抄是筛选不是保存", "broken`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function jsonReply(content) {
  return JSON.stringify({
    id: 'chatcmpl-mock',
    object: 'chat.completion',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': '*',
    });
    return res.end();
  }
  if (req.method === 'GET' && url.pathname === '/article') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(ARTICLE);
  }
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end(`mock ${mode} ok`);
  }
  if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
    let body = '';
    for await (const chunk of req) body += chunk;
    console.log(`[mock] ${mode} <- ${body.slice(0, 120)}...`);
    if (mode === 'slow') await sleep(6000);
    const content = mode === 'bad' ? BAD_REPLY : GOOD_SUMMARY;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(jsonReply(content));
  }
  res.writeHead(404).end('not found');
});

server.listen(PORT, '127.0.0.1', () => console.log(`mock LLM (${mode}) on http://127.0.0.1:${PORT}/v1 · article: /article`));
