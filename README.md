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
DISNEY_PASSWORD=您的 MyDisney 帳號密碼
# 選填：自動化 OTP (配合 MailOTP 功能)
GMAIL_USER=您的 Gmail 帳號
GMAIL_APP_PASSWORD=您的 Gmail 應用程式專用密碼
```

### 3. 安裝步驟
```bash
npm install
npx playwright install chromium
```

---

## 🚀 工具列表 (Tools Reference)

### 1. `get_my_plans`
從預訂儀表板進入，自動辨識每日行程。
*   **用途**: **核心入口工具**。系統會自動掃描預訂總覽頁面，辨識出第一個有效的預訂編號。
*   **參數**: 無。
*   **回傳範例**:
    ```json
    {
      "reservation": { "reservationId": "44079507", "stateroom": "11879", "title": "5-Night Disney Adventure..." },
      "plans": [ { "day": "Day 1", "date": "2026-04-23", "activities": [...] } ]
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
*   **回傳**: 該類別下所有項目的名稱、預估價格、地點以及內部的 `productId`。

### 4. `get_activity_details`
針對特定項目進行深度掃描，確認精確的可預訂時段。
*   **參數**: 
    *   `reservationId`, `slug`, `date`, `activityName` (皆為必填)。
*   **回傳**: 
    *   `status`: "Available", "No Slots", 或 "Sold Out"。
    *   `times`: 目前可選的時間點（如 `["6:00 PM", "8:15 PM"]`）。

### 5. `add_activity`
新增活動至預訂行程。
*   **參數**: 
    *   `reservationId`, `slug`, `date`, `activityName`, `timeSlot` (皆為必填)。
*   **功能特點**: 
    *   **完整錯誤捕獲**: 自動識別並回報官網原始錯誤文字（例如："We are currently unable to complete your request..."），不進行任何截斷或模糊轉譯。
    *   **狀態監控**: 自動追蹤預訂後的跳轉與 Success 標籤。
    *   **證據留存**: 無論預訂成功或失敗，均會自動生成當下畫面的截圖與 HTML 存檔供後續核對。
*   **回傳範例**:
    ```json
    {
      "status": "FAILED",
      "message": "We are currently unable to complete your request. Please check availability once on board or try again later.",
      "evidence": "/path/to/debug/booking_FAILURE.png"
    }
    ```

### 6. `ensure_login`
驗證登入狀態並導出 Session 數據。
*   **用途**: 供其他自動化工具（如獨立的爬蟲腳本）直接復用登入狀態。
*   **回傳**: 包含 `cookies` 與 `webStorage` 的完整 JSON。

---

## 🔄 推薦自動化工作流 (Workflow)

為確保代理人運作流暢，建議遵循以下路徑：

1.  **第一步：辨識身分**
    呼叫 `get_my_plans` (不帶 ID)。
    -> 從回傳的 `reservation.reservationId` 取得身分，並從 `plans` 確認目前空檔。

2.  **第二步：尋找目標**
    呼叫 `get_all_activity_types` 獲取想查看的類別 (如 `SPA`)。
    -> 呼叫 `get_activity_list` 找出該類別在特定日期的所有活動名稱。

3.  **第三步：精確監控**
    針對心儀活動呼叫 `get_activity_details` 獲取時段。

---

## ⚠️ 代理人操作規範

*   **錯誤處理**: 系統實施 **Fail Fast** 策略。任何觸發 404 (Page Not Found) 或登入失敗的情況，均會回傳以 `STRICT FAIL` 開頭的錯誤，請代理人優先分析錯誤訊息中的 `Evidence` (截圖路徑)。
*   **效能限制**: 系統內建併發鎖，同時間僅允許一個瀏覽器實體運行。請勿平行發送多個查詢。
