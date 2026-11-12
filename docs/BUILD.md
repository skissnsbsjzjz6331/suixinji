# 构建与安装

## 环境

| 平台 | 需要的工具 |
| --- | --- |
| Web | Node.js 22+ |
| Android / 华为 | Node.js 22+、JDK 17+、Android SDK API 36、Android Build Tools、Gradle Wrapper |
| iOS | macOS、Xcode 26+、Node.js 22+；真机还需 Apple 开发者签名 |

原生项目使用 [Capacitor 8](https://capacitorjs.com/docs/getting-started)。Android 最低 API 24（Android 7）；iOS 最低版本 15。

## 同步 Web 代码

```bash
npm ci
npm run build
npx cap sync
```

`cap sync` 会把 `dist/client` 中的离线页面复制进 Android 和 iOS 工程。每次修改 React 代码后都需要重新执行。

## Android 安装包

Windows PowerShell：

```powershell
cd android
.\gradlew.bat assembleStandardDebug assembleHuaweiDebug
```

macOS / Linux：

```bash
cd android
./gradlew assembleStandardDebug assembleHuaweiDebug
```

产物位置：

| 版本 | 应用 ID | APK 路径 |
| --- | --- | --- |
| 标准版 | `app.suixinji.ledger` | `android/app/build/outputs/apk/standard/debug/app-standard-debug.apk` |
| 华为版 | `app.suixinji.ledger.huawei` | `android/app/build/outputs/apk/huawei/debug/app-huawei-debug.apk` |

这两个 Debug APK 已由 Android 工具自动签名，可用于个人手机安装与测试；它们**不是应用商店正式发布包**。正式上架需由发布者保管签名密钥并构建 Release APK/AAB。两个应用 ID 的本地数据隔离，切换版本前请先导出账本。

## iOS

在 macOS 上执行 `npx cap sync ios`，用 Xcode 打开 `ios/App/App.xcodeproj`，选择自己的开发团队与设备后构建。无 Apple 签名时可以编译模拟器版本，但无法生成可安装到普通 iPhone 的 IPA。不要把证书、描述文件或私钥提交到仓库。

## GitHub Actions

[`.github/workflows/build.yml`](../.github/workflows/build.yml) 在 `main` 分支和 `v*` 标签推送时构建两种 Android Debug APK，并对 iOS 模拟器工程做编译检查。可在 Actions 运行记录中下载 Artifacts。iOS Artifact 是模拟器 `.app`，不能直接安装到真机。

## 验证

```bash
npm run check:runtime
npm run build
npm run test:sites
```

仓库中的 `scripts/verify-ledger.mjs` 使用全新的非持久化浏览器会话测试账单操作，不读取日常浏览器数据。运行前需要本地预览服务及 Chrome。
