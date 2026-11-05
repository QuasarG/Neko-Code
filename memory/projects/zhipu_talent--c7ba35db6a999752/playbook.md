# 做法

## 生产部署纪律
生产＝阿里云 39.102.71.80:29652（凭据走本机 ssh 配置，不入记忆）。rebuild 在 dev 分支；重启前必查 running=0；分支即环境；staging systemd override 钉死 WorkingDirectory；SPA 缓存要强刷。六坑：pkill 自杀、tsc 静默失败、Dialog 黑屏、ssh nohup 须 `</dev/null`、ssh 被 Clash fake-ip 咬（走代理隧道）、GLM tool_calls 流式解析容错。评估 worker：批注偏移规则、人员授权旁路＝查库批 pending。验收：自己点一遍再交。飞书权限边界：租户凭证无通讯录（99991672）、可见范围＝user token 视角、40004/40014/99991663 语义、lark-cli scope 描述会误导。

## aitime.cn 基础设施
39.102.64.47＝cn-beijing ECS i-2ze88e8uxh0lctgx1uxu（公司账户 1725888154791835，aitime.pem@23333 root，白名单 219.143.146 是 2026-10-25 加的、用完可撤）。4C/7.7G/盘余 66G；nginx 1.16.1 仅 heyun.conf；本机 MySQL 3306。182.92.129.1＝zexin 个人服务器（1235433470966767，g99.pem；aitime 重构预览跑上面，23333↔测试机不通）。同侧同事 zhaozc/songqimao/weihu，切换备份做足即可。挂载评估：同款 systemd(8787)＋nginx 可搬、并存零风险，正式切换低峰＋回滚；数据口径待定。手机 bot 常驻挂起，182 为候选机。

## 周报流水线
周报＝wiki《工作周报》(docx SKZNdAMCpoetw7x36ZRcqB19nR9)，周期＝H1 起始日期＋嵌入 sheet（token Nzz8sRwjih8BFxt12SxcbAcRnif）。子表 6 行：r1 本周工作；r2 表头 板块(A:B)/内容(C:E)/进度(F)/完成(G 下拉)；r3 Radar；r5 下周计划；r6 AI TIME 重构；百分比列是文本型。来源＝zhipu_talent＋aitime 上周 git log。坑：docs block_insert_after 嵌 sheet 服务端复制出新 sheet id 且可能取旧 revision——嵌完对新 id 重写并回读；样式合并格用 +sheet-copy 继承再逐格回读。

## 会议记录 Base
Base＝JYPeb2bWBaevOCsQyGTc1iAInkv（wiki KcjdwElBJi7LYpkzN88ceSw2nIb）；周五组会大群 oc_1524244d0b23b458299edbe8a3430614、周三例会小群 oc_0f9b7c39da6ebed6659e88bed6292086。
