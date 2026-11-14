# Monkeytype 功能参考

参考基线为 `3aa6c2e448d3d13084daac678070ca9734b77ba1`。只借鉴功能和交互思路，未直接移植其组件：

- [密码输入控件](https://github.com/monkeytypegame/monkeytype/blob/3aa6c2e448d3d13084daac678070ca9734b77ba1/frontend/src/ts/components/ui/form/InputField.tsx)的显隐状态在 React 的独立密码字段中实现，并保留自动填充、焦点与可访问名称。
- [个人最佳](https://github.com/monkeytypegame/monkeytype/blob/3aa6c2e448d3d13084daac678070ca9734b77ba1/frontend/src/ts/test/result-pb.ts)及[配速](https://github.com/monkeytypegame/monkeytype/blob/3aa6c2e448d3d13084daac678070ca9734b77ba1/frontend/src/ts/test/pace-caret.ts)启发本项目按条件比较成绩，以及使用上次、个人最佳或自定义配速。中文按本项目字／分钟，英文按现有 WPM；配速不参与评分。
- [命名预设](https://github.com/monkeytypegame/monkeytype/blob/3aa6c2e448d3d13084daac678070ca9734b77ba1/frontend/src/ts/components/pages/settings/custom-setting/Presets.tsx)启发显式保存、应用与更新；本项目在切换前按既有流程保留当前草稿。
- 过程采样和稳定性使用本项目实际采样及独立公式，不能从最终平均速度重建，也不宣称与 Monkeytype 等价。
