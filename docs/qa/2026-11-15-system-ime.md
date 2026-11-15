# 真实中文输入法验收

使用隔离的 Xvfb 显示、独立 D-Bus 和临时配置启动 Fcitx5 拼音（5.1.19）、Google Chrome 156.0.8078.79 与临时 SQLite 测试服务。通过 XTest 向该独立显示发送键盘事件；浏览器观察到 `isTrusted: true` 的组合事件和 `isComposing: true` 的输入事件。测试未切换或修改用户桌面的输入法；执行后桌面原有输入法仍为 `keyboard-us`。

实际流程输入 `nihao` 时，已确认字符数保持 0、计时开始，并在 5 秒过程采样中记录进度和正确数为 0；组合期间 `Alt+P` 没有暂停。选择候选词后提交“你好”，换行后提交“世界”，再以三次退格跨回上一行。暂停、刷新、继续后再次换行和提交“世界”均通过。[组合输入截图](screenshots/system-ime-composition.png)是浏览器页面截图，系统候选窗口不在截图范围内。

可用 `scripts/verify-system-ime.sh` 重复此检查。脚本自己启动隔离显示、输入法和测试服务，并在结束时清理临时目录；需要 Linux、Xvfb、Fcitx5 拼音、Chrome、XTest、D-Bus、Python、Playwright 及已构建的客户端。本次系统未安装 Xvfb，将 Ubuntu `xvfb` 包 `2:21.1.22-1ubuntu1.3` 解包到临时目录，通过 `TYPING_XVFB_BINARY` 指定，没有安装系统包。此结果覆盖 Linux Fcitx5 拼音与 Chrome X11，不等同于 Windows、macOS 或手机系统输入法验收。
