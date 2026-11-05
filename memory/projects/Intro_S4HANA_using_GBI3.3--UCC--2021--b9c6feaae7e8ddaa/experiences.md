# 经历

- 2026-10-25：结案——zexin 已另侧把实验水完交差（水课不追求严谨），不再攻 SAP。未攻下的墙别再白撞：Fiori Create Quotation 按钮对 CDP 合成点击免疫（click/JS/Enter 全无效），需真人一次真实手势，是整条 SD 链唯一断点。
- 附 WebGUI/UR 自动化秘籍（做别的网页系统也通用）：FLP 劫持 window.open 抓 hash→resolveHashFragment 本页打开；UR 字段只认 chrome_fill_or_select（JS 设 value＋event＝幻影值），用真点击后 elementInfo 给的精确 id（有隐藏替身）；'0' 会被部分输入框吞——JS 直写＋双事件＋立刻真 Enter；下拉＝真点击 ∨＋typeahead 逐字符＋坐标点选（F4 弹窗更稳）；表格＝双击进编辑＋逐字符 key＋Enter；WebGUI 表格 id 每次往返全变（tbl9xxxx[n,m]_c），现查现用；ok-code 走私＝JS 写 ToolbarOkCode.value='/nXXX'＋真点任意按钮借往返执行；状态栏错误会残留，以字段实际值为准。
