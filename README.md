# Disney Cruise MCP Server

此專案是為 Disney Cruise Line (DCL) 提供的 Model Context Protocol (MCP) 伺服器，專為資源受限的環境 (如 2GB RAM 的 Ubuntu Server) 進行優化，具備嚴格的報錯機制與自動化測試。

## 版本資訊
- **Version**: 1.5.0
- **核心架構**: 基於 Playwright-Chromium 與 MCP SDK。

## 核心特性

### 1. 2GB RAM 效能優化 (Single-Page Policy)
- **單頁策略**: 強制執行 Single-Page Policy，防止多標籤頁導致的 OOM 崩潰。
- **資源阻擋**: 自動阻擋圖片、字體、Analytics 與社交媒體追蹤器，將 CPU 資源留給 SPA 水合 (Hydration)。
- **CDP 持久連接**: 透過 Chrome DevTools Protocol 連接現有瀏覽器，維持 Session 穩定性。

### 2. 嚴格錯誤回報機制 (Strict Fail)
- **零模糊度**: 取消 `UNKNOWN` 狀態，任何非預期頁面或超時均會立即拋出 `STRICT FAIL`。
- **證據驅動**: 報錯時自動儲存 `.png` 截圖與 `.html` 原始碼至 `/home/ubuntu/.hermes/debug/`。
- **Stitch 404 偵測**: 針對 DCL 常見的 "Someone Ate the Page!" 錯誤進行即時偵測。

### 3. 自動化登入與 MFA 處理
- **OTP 輪詢**: 與 `otp_daemon.py` 連動，自動從 `otp.txt` 讀取 6 位數驗證碼。
- **Session 保護**: 偵測到驗證碼畫面時會自動跳過帳密輸入，防止 Session 無效化。

## 安裝與設定

1. **安裝依賴**:
   ```bash
   npm install
   ```

2. **環境變數**:
   建立 `.env` 檔案並填入憑證：
   ```text
   DISNEY_EMAIL=your_email@gmail.com
   DISNEY_PASSWORD=your_password
   ```

3. **啟動瀏覽器**:
   確保 Chrome 以 CDP 模式在 9222 端口運行。

## 測試

專案包含自動化單元測試，涵蓋狀態判定、SPA 穩定性與任務編排邏輯。

```bash
npm test
```

*本專案已配置 Husky Pre-commit Hook，提交程式碼前會自動執行測試。*

## 檔案結構
- `server.js`: MCP 伺服器主程式。
- `tests/`: 自動化單元測試目錄。
- `.husky/`: Git Hooks 設定。
- `.gitignore`: 已排除機密憑證與除錯證據。
