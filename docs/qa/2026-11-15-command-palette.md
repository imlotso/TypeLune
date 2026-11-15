# 快捷操作与功能面板

“更多”菜单及专注模式提供可点击的功能面板；设置中也可查看快捷键与功能。面板支持搜索，动作调用现有暂停／继续、重新开始确认、设置和主要页面导航。打开面板会先暂停并保存当前进度；从专注模式切换页面时退出专注布局。

快捷键默认开启，可在设置中关闭：`Alt+P` 暂停／继续，`Alt+R` 重新开始，`Alt+S` 设置，`Alt+K` 功能面板，`Ctrl+Shift+1–4` 分别进入练习、文章库、排行榜和我的记录。输入法组合期间、其他表单和弹窗内不触发这些动作；不拦截原有 Tab、Enter 和 Escape。AltGraph 及产生其他字符的 Option 组合不作为快捷键处理。

`shortcutsEnabled` 保存在工作区设置，缺失时默认开启，并包含在游客导入、个人导出及练习设置文件中。旧版设置文件没有该字段时按开启处理；新服务端保留旧客户端省略的已存字段。回退旧服务前应停止写入并备份，以免旧服务在后续同步时丢弃字段。

参考 [Monkeytype 命令面板快捷键](https://github.com/monkeytypegame/monkeytype/blob/3aa6c2e448d3d13084daac678070ca9734b77ba1/frontend/src/ts/input/hotkeys/commandline.ts)与[重启快捷键](https://github.com/monkeytypegame/monkeytype/blob/3aa6c2e448d3d13084daac678070ca9734b77ba1/frontend/src/ts/input/hotkeys/quickrestart.ts)，本项目使用不占用逐行输入所需 Tab／Enter 的组合，并保留原有重启确认。
