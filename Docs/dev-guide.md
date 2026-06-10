# 開發指南 (Development Guide)

## 開發環境需求

| 工具 | 版本 | 安裝 |
|---|---|---|
| Python | >= 3.14 | winget install Python.Python.3.14 |
| uv | latest | pip install uv |
| Node.js | >= 22 | winget install OpenJS.NodeJS.LTS |
| pnpm | latest | npm install -g pnpm |
| Docker Desktop | latest | winget install Docker.DockerDesktop |

## 初始化專案

### 1. 複製環境變數

```bash
cp .env.example .env
```

編輯 `.env`，至少確認以下欄位：

```ini
DB_USER=erp_admin
DB_PASSWORD=SuperSecretPassword_001
DB_NAME=erp_system
SECRET_KEY=<隨機產生的金鑰>
ADMIN_DEFAULT_EMAIL=admin@erp.local
ADMIN_DEFAULT_PASSWORD=<管理員密碼>
```

### 2. 啟動基礎設施

```bash
docker compose up -d db redis
```

PostgreSQL 容器首次啟動會自動執行 `docker/init.sql` 建立資料表。

### 3. 後端設定

```bash
cd backend

# 建立虛擬環境並安裝依賴
uv sync

# Database Seeding — 建立 Admin 帳號
uv run flask seed

# 啟動開發伺服器
uv run flask run
```

### 4. 前端設定

```bash
cd frontend

# 安裝依賴
pnpm install

# 啟動開發伺服器
pnpm dev
```

瀏覽器開啟 `http://localhost:5173`。

## 開發工作流程

### 後端新增一個 API 端點

1. 在 `app/api/xxx/routes.py` 新增 route
2. 在 `app/api/xxx/schemas.py` 定義 request/response schema
3. 商業邏輯寫在 `app/services/xxx_service.py`
4. 自動寫入 Audit Log（透過 `audit_service.py`）

### 後端新增一個資料表

1. 在 `app/models/` 新增 model 檔案
2. 執行 `flask db migrate -m "描述"` 產生遷移腳本
3. 執行 `flask db upgrade` 更新資料庫
4. 更新 `Docs/database.md`

### 前端新增一個頁面

1. 在 `pages/` 建立頁面元件
2. 在 `api/` 建立對應的 API 函式
3. 在 `routes/index.tsx` 加入路由 + 守衛
4. 如需要共用元件，建立在 `components/ui/`

## 資料庫遷移 (Database Migration)

使用 Flask-Migrate (Alembic) 管理結構變更：

```bash
# 初始化遷移目錄（僅首次）
flask db init

# 產生遷移腳本
flask db migrate -m "add_coding_rules_table"

# 套用遷移
flask db upgrade

# 回退上一版
flask db downgrade
```

## Database Seeding

執行 flask cli 指令：

```bash
flask seed
```

此指令會：

1. 檢查是否已有 Admin 角色，若無則建立
2. 檢查是否已有 Admin 使用者，若無則從 `.env` 讀取 ADMIN_DEFAULT_EMAIL 與 ADMIN_DEFAULT_PASSWORD 建立
3. 寫入 Audit Log 記錄

## 程式碼規範

### 後端

- 遵循 PEP 8
- route function 保持簡潔：解析輸入 → 呼叫 service → 回傳結果
- service 回傳 dict，不回傳 Flask Response 物件
- 所有敏感操作（登入、註冊、核准、鎖定）都寫 Audit Log

### 前端

- 使用 functional component + hooks
- 型別定義放在 `types/index.ts`
- API 呼叫統一透過 `api/client.ts` 的 Axios instance
- 頁面元件不直接使用 `fetch` 或 `axios`，透過 `api/` 底下的函式

## Git 使用規範

```bash
# 分支命名
feature/xxx    # 新功能
fix/xxx        # 修 bug
refactor/xxx   # 重構
docs/xxx       # 文件

# Commit 訊息格式
[類型] 簡短說明

# 範例
feat: add admin approve user endpoint
fix: correct rate limit key for login
docs: update API reference
```
