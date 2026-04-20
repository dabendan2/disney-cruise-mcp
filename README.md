# Disney Cruise Line (DCL) MCP Server

這是一個專為 **Disney Cruise Line (DCL)** 預訂管理設計的 MCP (Model Context Protocol) 伺服器。它能自動執行登入、繞過 OTP 驗證、掃描航程計畫，並監控特定活動（如 Palo、SPA、Teppanyaki）的預訂狀態。

## 🛠 安裝與環境需求

### 1. 系統需求
*   **Node.js**: v18.0.0 或更高版本。
*   **瀏覽器**: Playwright Chromium (系統自動調用)。

### 2. 環境變數配置
參考 `.env.example` 在專案根目錄建立 `.env` 檔案：
```env
DISNEY_EMAIL=您的 MyDisney 帳號電子郵件
DISNEY_PASSWORD=您的 MyDisney 帳號密碼
GOOGLE_TOKEN_PATH=/絕對路徑/到/google_token.json
```
*   **自動化 OTP**: 系統使用 Google OAuth 憑證進行 Gmail 郵件掃描。
    *   **Hermes 使用者**: 執行 `hermes setup` 完成授權，預設路徑為 `~/.hermes/google_token.json`。
    *   **通用使用者**: 可使用 `google-workspace` 或 `gog cli` 工具獲取授權 Token，並透過 `GOOGLE_TOKEN_PATH` 指定位置。
*   **航程自定義**: 可選設定 `SHIP` (如 DA) 與 `PORT` (如 SIN) 以對應不同航線。

### 3. 日誌系統 (Logging)
所有自動化過程的詳細日誌會同步輸出至：
*   **路徑**: `~/.disney-cruise/logs/<timestamp>.log`
*   **查看實時日誌**: `tail -f ~/.disney-cruise/logs/*.log`
*   **用途**: 用於事後審計、效能分析以及在 MCP 模式下不干擾 JSON 輸出。

### 4. MCP 伺服器配置 (Hermes Agent)
在 `~/.hermes/config.yaml` 中，請確保使用頂層鍵名 `mcp_servers`，並利用 `-r dotenv/config` 優化環境變數載入：
```yaml
mcp_servers:
  disney-cruise:
    command: "node"
    args:
      - "-r"
      - "dotenv/config"
      - "/home/ubuntu/.hermes/mcp/disney-cruise/src/index.js"
      - "dotenv_config_path=/home/ubuntu/.hermes/mcp/disney-cruise/.env"
    env:
      NODE_PATH: "/home/ubuntu/.hermes/mcp/disney-cruise/node_modules"
      NODE_ENV: "production"
```
這可以避免在主要設定檔中暴露敏感的電子郵件與密碼。

---

## 🚀 工具列表 (Tools Reference)

### 1. `get_my_plans`
從預訂儀表板進入，自動辨識每日行程。
*   **用途**: **核心入口工具**。系統會自動掃描預訂總覽頁面，辨識出第一個有效的預訂編號。
*   **參數**: 無。
*   **回傳範例**:
    ```json
    {
      "reservation": { "reservationId": "44079507", \"stateroom\": \"11879\", \"title\": \"5-Night Disney Adventure...\" },
      "plans": [ { \"day\": \"Day 1\", \"date\": \"2026-04-23\", \"activities\": [...] } ]
    }
    ```

### 2. `get_bookable_activity_types`
取得該預訂在特定日期可加購的所有活動類別。
*   **用途**: 獲取用於後續查詢的類別標籤 (Slug)，具備日期校驗功能，可過濾「下船日」的幽靈連結。
*   **參數**: 
    *   `reservationId` (字串, 必填): 8位數字編號。
    *   `date` (字串, 必填): 格式為 `YYYY-MM-DD`。
*   **回傳**: 包含 `type` 與 `slug` 的陣列，以及 `status` (如 `Available`, `Unavailable`, `Date Not Found`, `No Entry Point`)。

### 3. `get_activity_list`
獲取特定類別在指定日期的所有可選項目清單。
*   **參數**: 
    *   `reservationId` (必填)
    *   `slug` (必填): 活動類別代碼。
    *   `date` (必填): 格式為 `YYYY-MM-DD`。
### 4. `get_activity_details`
針對特定項目進行深度掃描，確認精確的可預訂時段。
*   **參數**: 
    *   `reservationId`, `slug`, `date`, `activityName` (皆為必填)。
*   **回傳**: 
    *   `status`: "Available", "No Slots", 或 "Sold Out"。
    *   `times`: 目前可選的時間點（如 `["6:00 PM", "8:15 PM"]`）。
*   **異常處理**: 若遇到 **Page Error 500** ("We're Working on It")，系統會立即報錯並指引使用 `get_bookable_activity_types` 確認該日期是否真的可預約。

### 5. `add_activity`
新增活動至預訂行程。
*   **參數**: 
    *   `reservationId`, `slug`, `date`, `activityName`, `timeSlot` (皆為必填)。
*   **功能特點**: 
    *   **智慧人數選擇**: 若活動說明註明 \"Book for 1 Guest only\"，系統會自動切換為單人模式。
    *   **衝突偵測**: 自動識別 \"not available for selection\" 或時段衝突，並回傳 `ALREADY_BOOKED`。
    *   **動態渲染等待**: 取代固定等待，精確監控 SPA 渲染進度，大幅提升預訂速度。
    *   **證據留存**: 自動執行 `scrollIntoView` 並產生包含成功標籤的截圖。
*   **回傳範例**:
    ```json
    {
      \"status\": \"SUCCESS\",
      \"evidence\": \"/path/to/debug/booking_SUCCESS.png\"
    }
    ```

### 6. `ensure_login`
驗證登入狀態並回傳當前的 Session 憑證（Cookies）。
*   **用途**: **外部整合工具**。驗證登入狀態後會回傳加密的 Session 憑證。這允許使用者使用其他通用瀏覽器工具（如 `browser_navigate`）直接存取迪士尼郵輪網域，以支援尚未開發為 MCP 專用工具的功能。
*   **應用場景**: 例如存取 **Onboard Gifts** (`https://disneycruise.disney.go.com/gifts-and-amenities/`) 進行禮品挑選，或其他需要登入權限的 DCL 專屬頁面。
*   **參數**: `reservationId` (必填)。

---

## 🔄 推薦自動化工作流 (Workflow)

1.  **辨識身分**: 呼叫 `get_my_plans` 取得 ID。
    *   **優化建議**: 預訂編號與航程日期通常是不變的。代理人應在第一次取得後，將其儲存至 `memory`（例如：「預訂 44079507 的航程為 4/23-4/27」），以避免後續對話或 Session 中重複呼叫 `get_my_plans` 造成額外等待。
2.  **尋找目標**: 呼叫 `get_activity_list` 找出活動名稱。
3.  **精確監控**: 針對目標呼叫 `get_activity_details` 獲取時段。
4.  **執行預訂**: 呼叫 `add_activity`。

---

## ⏱ 效能基準與合理等待時間 (Performance Baseline)
系統執行於 2GB RAM 環境，由於 DCL 網站為重度 SPA 應用，以下為自動化操作的合理耗時參考：

*   **`ensure_login` (Session 檢查)**:
    *   已登入狀態：**~5-10 秒** (含兩次 CPU 穩定度檢查)。
    *   完整登入 (Email + 密碼 + OTP)：**45-70 秒** (視 Gmail 收到代碼的速度而定)。
*   **`get_my_plans` (核心入口)**: **40 - 80 秒** (V2 優化版)。包含自動偵測直達、資源過濾、儀表板辨識及完整行程擷取。
*   **`get_activity_list` (列表掃描)**: **35-45 秒 / 每日期**。
*   **`get_activity_details` (深度監控)**: **40-50 秒 / 每項目**。包含導航、SPA 渲染等待及時段抓取。
*   **`add_activity` (預訂操作)**: **1 - 1.5 分鐘**。涉及多個模態框切換與狀態校驗。

**代理人提示**: 若操作未超過上述時間，請耐心等待。所有操作皆有 30s 動作逾時與 2m 總流程逾時保護。

## ⚠️ 代理人操作規範
*   **Fail Fast**: 偵測到 404 或強制登出時立即中斷並報告證據。
*   **資源管理**: 由於內存限制 (2GB)，建議在連續執行多個工具間呼叫 `ensure_login` 重新載入 Session 數據。
*   **證據存放**: 發生錯誤時，請檢查 `~/.disney-cruise/debug/` 下的 `.png` 與 `.DOM.html` 檔案。
