# 做法

## 会话存储布局
权威历史＝pi 原生 JSONL：~/.neko_pi/sessions/<cwd 编码>/<时间戳>_<id>.jsonl，首行 header{type:session,version:3,id,cwd}，每行一个 entry，parentId 串成树。桥投影＝sessions/bridge/<bridgeId>.json（标题/待投递队列/投影历史/entryByMessage）；启动指针＝bridge-backends/<bridgeId>.json；运行时状态＝runtime/state.sqlite（回执/消息状态/活动，不存正文）。分叉＝forkFromEntry 新建 JSONL（header.parentSession 指向源），源文件不动。

## 模型配置 id 约定
models.json 的 model.id 原样发给上游 API，必须是提供商真实代号（自定义后缀如 `glm-5.3-flash[1M]` 被 zai 400/1211 拒）。会话引用的模型消失时降级默认模型打开，别在创建 agent 时抛错（否则端点连锁 500、TUI 进恢复屏）。

## bundle 双轨与开发纪律
命令跑 dist/bundle，./pi-test.sh 跑源码；改 src（尤其 tui-bridge、vendor TUI）后必须 `npm run build`（网络坏用 build:offline），否则新前端配旧后端（capabilities undefined、integration 空列表）；构建需用户授权。先查上游再自研、fork 优先 cherry-pick；测试会话清理＝删 jsonl＋activities/context_receipts 行；测试一律隔离 home（NEKO_PI_HOME=/tmp/xxx）；real-GLM 协议＝备份→隔离→验证→删备份；组件 invalidate 是被动下行钩子，自驱动重绘会栈溢出；state.sqlite 的 project 行 owner＝裸 projectId 无前缀；TUI 中止是 ESC；display:false 永不渲染——断言产物不断言画面。

## Next 应用进 npm monorepo
npm workspace 提升＋根锁文件下 Next16 Turbopack 必炸：应用摘出根 workspaces 独立 install，本地包 `file:`＋`--install-links=true` 装拷贝（软链 realpath 出域不认），源包变更后 sync 刷；biome.json `"!!apps"`＝没排除（上游潜伏 bug）；锁文件提交要 `PI_ALLOW_LOCKFILE_CHANGE=1`。pi 系 SDK 不自动带 CLI 的 builtInExtensions，嵌 SDK 的前端自己 import `./extensions` 装配。dev 带 PI_CODING_AGENT_DIR/SESSION_DIR 指向 ~/.neko_pi 即双前端同一本账（详 NEKO-WEB.md）。

## pi-web 接入
首选 agegr/pi-web（自带简中，`npx @agegr/pi-web@latest` :30141）：启动带 PI_CODING_AGENT_DIR / PI_CODING_AGENT_SESSION_DIR 两个 env 即可列出、续接 ~/.neko_pi 会话；pi 四模式共用同一 agent/会话栈，RPC＋SDK 是 web 的地基。待验证：env 下会话可见性、persona 注入消息在 web 的渲染、fork 二进制名是否被前端硬编码。挂机长跑备选 jmfederico/pi-web；多 agent 混管 agent-of-empires；容器化 piclaw。

## 会话分支语义
.jsonl 是只追加的树（id＋parentId）；**分支＝leaf 挪回更早 entry，历史一字不改**、旧枝可切回；上下文＝root→leaf 一条路径，兄弟枝不可见、token 从分支点重累；记忆/persona/衣橱不在会话文件里，**分支绝不回滚它们**。pi-web 两按钮：Edit from here＝同文件分叉，New session＝派生独立文件。

