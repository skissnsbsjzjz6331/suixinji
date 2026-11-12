# 1.0.0 验证记录

- 浏览器预览：检查米白与深色空账本、统计页、设置页，截图见 `docs/screenshots/`。
- 原生布局模拟：在隔离浏览器中模拟 Android Capacitor 平台，检查全屏空账本与“记一笔”弹层。未使用任何真实账单。
- 交互：隔离会话通过长列表加载、月/日筛选、单条删除、周/月/年选择和清空后刷新验证。
- 工程：`npm run build`、`npm run test:sites`、`npm run check:runtime`；原生工程通过 `npx cap sync` 同步。
- 待设备验证：Android / 华为真机 APK 安装，iOS Xcode 签名及真机运行。当前 Windows 环境尚未配备 Android SDK 或 Xcode。
- 已知限制：扫描 PDF 无 OCR；不保证识别任意银行账单版式；iOS 真机需要 Apple 签名；本地数据需要用户自行导出备份。
