# 做法

生产＝阿里云 182.92.129.1（rsync＋systemd :8787，密钥 g99.pem 在本机；老库 39.102.64.47 待替换，ADMIN_PASSWORD 在服务器 env 不入记忆）。部署链路：rsync 推送→systemd 重启；上线＝替换老库 IP＋certbot 签证书。域名 aitime.cn 在他人账号（智谱 zhichao.zhao@aminer.cn），泛证书 2027-01 到期不自动续。字体铁律：全站只许思源宋体＋金字社得正体，换字体只动 display.woff2 一个文件。性能基线：LQIP/bootfont 派生全自动化；GSAP 打包约束；canvas 分桶合批铁律。动效三模块分工（GSAP/点阵/形状层）；设计红线：fixed 贴视口、内容不避让。版本线：每版打 tag 可回退。
