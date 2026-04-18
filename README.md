# Disney Cruise Line (DCL) MCP Server

這是一個專為 **Disney Cruise Line (DCL)** 預訂管理設計的 MCP (Model Context Protocol) 伺服器。它能自動執行登入、繞過 OTP 驗證、掃描航程計畫，並監控特定活動（如 Palo、SPA、Teppanyaki）的預訂狀態。

## 🛠 安裝與環境需求

### 1. 系統需求
*   **Node.js**: v18.0.0 或更高版本。
*   **瀏覽器**: Playwright Chromium (系統自動調用)。

### 2. 環境變數配置
在專案根目錄建立 `.env` 檔案，填入以下必要資訊：
```env
DISNEY_EMAIL=您的 MyDisney 帳號電子郵件
DISNEY_PASSWORD=*** MyDisney 帳號密碼
# 選填：自動化 OTP (配合 MailOTP 功能)
GMAIL_USER=您的 Gmail 帳號
GMAIL_APP_PASSWORD=*** Gmail 應用程式專用密碼
```
*   **自動加載**: 伺服器啟動時會自動讀取 `.env`，無需手動 `export` 環境變數。

### 3. 日誌系統 (Logging)
所有自動化過程的詳細日誌會同步輸出至：
*   **路徑**: `~/.disney-cruise/logs/<timestamp>.log`
*   **查看實時日誌**: `tail -f ~/.disney-cruise/logs/*.log`
*   **用途**: 用於事後審計、效能分析以及在 MCP 模式下不干擾 JSON 輸出。

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

### 2. `get_all_activity_types`
取得該預訂可加購的所有活動類別。
*   **用途**: 獲取用於後續查詢的類別標籤 (Slug)。
*   **參數**: 
    *   `reservationId` (字串, 必填): 8位數字編號。
*   **回傳**: 包含 `type` (中文/英文描述) 與 `slug` (系統代碼，如 `DINE`, `SPA`) 的陣列。

### 3. `get_activity_list`
獲取特定類別在指定日期的所有可選項目清單。
*   **參數**: 
    *   `reservationId` (必填)
    *   `slug` (必填): 活動類別代碼。
    *   `date` (必填): 格式為 `YYYY-MM-DD`。
*   **回傳**: 該類別下所有項目的名稱、預估價格、地點以及內部的 `productId`。\n\n### 4. `get_activity_details`
針對特定項目進行深度掃描，確認精確的可預訂時段。
*   **參數**: 
    *   `reservationId`, `slug`, `date`, `activityName` (皆為必填)。
*   **回傳**: 
    *   `status`: \"Available\", \"No Slots\", 或 \"Sold Out\"。
    *   `times`: 目前可選的時間點（如 `[\"6:00 PM\", \"8:15 PM\"]`）。

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

---

## 🔄 推薦自動化工作流 (Workflow)

1.  **辨識身分**: 呼叫 `get_my_plans` 取得 ID。
2.  **尋找目標**: 呼叫 `get_activity_list` 找出活動名稱。
3.  **精確監控**: 針對目標呼叫 `get_activity_details` 獲取時段。
4.  **執行預訂**: 呼叫 `add_activity`。

---

## ⚠️ 代理人操作規範

*   **Fail Fast**: 偵測到 404 或強制登出時立即中斷並報告證據。
*   **資源管理**: 由於內存限制 (2GB)，建議在連續執行多個工具間呼叫 `ensure_login` 重新載入 Session 數據。
