# Disney Cruise MCP Server

此專案是為 Disney Cruise Line (DCL) 提供的 Model Context Protocol (MCP) 伺服器，專為資源受限的環境 (如 2GB RAM 的 Ubuntu Server) 進行優化，具備嚴格的報錯機制與自動化測試。

## 版本資訊
- **Version**: 1.7.0
- **核心架構**: 基於 Playwright-Chromium 與 MCP SDK 的模組化架構。
- **CI/CD**: 已配置 GitHub Actions 自動化測試工作流。

## 核心特性

### 1. 模組化架構 (Modular Design)
- **src/index.js**: MCP 伺服器入口點。
- **src/automation/**: 封裝登入、導航與活動爬取邏輯。
- **src/browser/**: 處理 Playwright 引擎初始化與 SPA 穩定性監控。
- **src/utils/**: 包含 OTP 處理、性能守護 (Performance Guard) 與並發控制。

### 2. 2GB RAM 效能優化 (Single-Page Policy)
- **單頁策略**: 強制執行 Single-Page Policy，防止多標籤頁導致的 OOM 崩潰。
- **資源阻擋**: 自動阻擋圖片、字體、Analytics 與追蹤器，將 CPU 資源留給 SPA 水合。
- **CDP 持久連接**: 透過 Chrome DevTools Protocol 連接現有瀏覽器，維持 Session 穩定性。

### 3. 嚴格錯誤回報與自我修復
- **Stitch 404 自我修復**: 偵測到 `null/null/null` 或 Stitch 404 頁面時，自動觸發 `ensureLogin` 重新導向，修復損壞的會話。
- **證據驅動**: 報錯時自動儲存 `.png` 截圖與 `.html` 原始碼至 `/home/ubuntu/.hermes/debug/`。
- **性能守護 (3x Guard)**: E2E 任務若執行時間超過基準值的 3 倍，將立即終止並拋出 `STRICT FAIL`，防止系統卡死。

### 4. 自動化登入與 MFA 處理
- **多模式登入**: 支援「分步式」與「同屏式 (Email+Password)」登入頁面偵測。
- **MailOTP 整合**: 自動透過 Gmail API 輪詢驗證碼，無需人工介入。

## 安裝與設定

1. **安裝依賴**:
   ```bash
   npm install
   ```

2. **環境變數**:
   建立 `.env` 檔案並填入憑證：
   ```text
   DISNEY_EMAIL=your_email@gmail.com
   DISNEY_PASSWORD=***
   ```

3. **啟動瀏覽器**:
   確保 Chrome 以 CDP 模式在 9222 端口運行。

## 測試

測試套件已拆分為單元測試與端到端測試，以兼顧開發速度與運行穩定性。

### 單元測試 (快速)
涵蓋邏輯判定、狀態機與 Mock 驗證。已配置為 **Pre-commit Hook**。
```bash
npm run test:unit
```

### 端到端測試 (完整)
真實模擬瀏覽器掃描 4 天的餐廳可用性，並驗證數據與性能指標。
```bash
npm run test:e2e
```

## 檔案結構
- `src/`: 原始碼目錄。
- `tests/unit/`: 單元測試腳本。
- `tests/e2e/`: 端到端測試腳本。
- `tests/res/`: 測試資源與基準數據。
- `.github/workflows/`: CI 設定檔。
- `.husky/`: Git Hooks 設定。
