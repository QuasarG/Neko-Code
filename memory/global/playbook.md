# 做法

收纳标准：只收跨项目复用的做法与机器环境事实；项目状态、地址、进度、一次性决策进对应项目书。

## 飞书 lark-cli
- wiki 建 Base：`wiki +node-create --obj-type bitable`，obj_token 即 base_token；field-update 全量 PUT；record-delete 也要 `--yes`。
- 坑 800010701：table-create 的 number 不带 style；formula 不与被引用字段同批、要 `--i-have-read-guide`。
- **Table 异步生效是最大坑**：建/删后立即读写拿旧态——删表→轮询到真消失→建→写→终验。
- `+record-list --format ndjson` 落 cwd 读完删；`--json @file` 只认 cwd、/tmp、~/files；IM 下载 `im +messages-resources-download`。
- record-batch-update 一行含未建 select 选项→整批 800030005，逐行定位。

## 生图管线（ComfyUI @ 数据盘）
- conda env `whisper`；ComfyUI:8188 加 `--cache-none` 防 OOM；GitHub 下载走 `curl -x http://127.0.0.1:7890`。MOSS-Image 口粮＝int8 DiT＋int8 TE。
- CharRef 换脸：int8 DiT→NSFW LoRA(1.0)→CharRef v2(0.9)→OstrisEdit(kv_cache)→SLG(22)→KSampler(euler/sgm_uniform/50/cfg3)；**参考图必须 768 脸部裁片缩 512**；输出 1152×864。
- 提示词：身份（East Asian 必写）→裸体声明→姿势分段含左右→环境→相机→anatomical 数量校验；负向 Western face/clothes/extra toes。**种子决定构图**，改构图换种子不靠"拉远"。
- 8G 卡：Qwen-Image 2.1 主力、Wan 2.2 TI2V-5B 可跑；双人画不了；产物归档 ~/Pictures/neko-gen/。

## 文档处理
- 扫描件 PDF 提不出字＝`pdftoppm -png -r 120` 转 PNG 直读；"全记中性 3"会埋没人，必须视觉复核。
- 课件 PDF→MD：pdftotext 成稿＋缺口页 `pdftoppm -r 150` 视觉回填；PPT 2-up 按（pN 上/下）标 H3；多册并行 subagent＋逐册验收；收尾必查工作目录杂质。
- docx 教训：docx-js children 嵌套静默丢弃、reversed+addprevious 得倒序、TOC 包 w:sdt、soffice 单实例锁。

## 评审与修复纪律
测试全绿≠对（断言写错也能绿）；只修测试指到的路径＝把洞挪隔壁，按语义修；验证格式跟到完整序列化链；提交时机也是语义；按不变式判不按推算判；删被引用配置时降级与重试是一等公民；报障必须真机复现；探针判活用 waitpid（僵尸骗 kill(0)）。

## 本机系统（Arch＋niri＋DMS）
- 沙箱 NoNewPrivs 焊死 sudo：提权走 `systemd-run --user --pipe pkexec`；.deb 用 makepkg 重打包；DMS polkit agent 随 quickshell SEGV 时兜底 polkit-gnome（日志沉默≠没发生）。
- niri 26.04 模糊来自 ~/.config/niri/blur.kdl（壁纸垫底零开销）；实时模糊仅 fuzzel；kitty opacity 0.8。kitty 里 ⏺ 被 Segoe UI Emoji 选走是文本字形根因；cc-switch 白屏＝fontconfig rejectfont→隔离 XDG_CONFIG_HOME；微信 bwrap 传文件＝binds.list 十目录。rime 神经重排已回滚（别重开）；Windows 备份在数据盘 zexin-backup。

## 网络栈
Clash nameserver-policy；FlClash fake-ip-filter 改动须完整重启；飞连×TUN 共存配置已固化（resolv.conf +i、zphz.cn 本地 DNS）；BUAA 内网域名 202.112.128.51/.50；**fake-ip 下查真实 DNS 用 `curl "https://223.5.5.5/resolve?name=X"`**；ssh 被 TUN 咬时走代理隧道。

## NAS nekonas（J1900/Debian 13）
tailnet 100.82.218.86（网线 192.168.100.1 兜底）、Samba \\library、Peach :8900（去重番号+时长+sha1）；mergerfs 3.2T mfs+moveonenospc；**绝不并发测速（6 并发罚 25 分钟）**；坑：pkill -f 自杀用 [.] 断匹配；凭据不进记忆。

## 流媒体抓取（HLS＋p,a,c,k,e,d 站）
聚合页真播放器是 `<IFRAME playrecord.biz/embed/<ID>>`；embed 页源码在 Dean Edwards 打包 eval 里——**Python 重演算法别 eval 硬跑**（抓 `\}\('PAYLOAD',A,C,'KEYS'\.split`，base-A 0-9a-zA-Z 逐位替换）；master.m3u8 **token 时间敏感，解包立刻下**；`ffmpeg -user_agent UA -referer embed页 -i master -map 0:p:2 -c copy -bsf:a aac_adtstoasc`；命名按 NAS 番号法。

## 模型拒答排查
zai 1301＝上下文带成人内容后整体拒答（普通提问也拒），落 0 字 assistant＋stopReason=error；处理＝切 model 或开新会话。读 errorMessage 分网络/审核/鉴权；服务端存活不证明模型答了。

## subagent 边界（实测）
explore/plan 只读四件套无 exec，要跑命令派 general-purpose；depth=1 实测封顶（孙代 Agent 工具被收走）；主会话后台＝受理即返 job id＋notification 唤醒，**孙代强制前台**；子代理无 persona/记忆，任务信息全写 prompt；结果一律本机对账；grep 验证构建要搜整个 dist/。

## 机器纪律（zexin 明示）
磁盘清理**先列清单经确认再动手**；浏览器缓存、在用应用缓存默认禁区；先删后问＝越界。
