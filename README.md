# ERP 自動編碼系統 (ERP Auto-Coding System)

這是一個現代化的企業級 ERP 自動編碼系統，具備嚴謹的 RBAC 權限控管與 Admin-Approved 註冊審核機制。系統核心透過最佳化的資料庫結構儲存多版本的「編碼規則樹」，並預留 LLM 與 RAG 技術介面，以實現依據料號特徵自動生成 16 碼企業料號的智能編碼功能。

## 技術棧 (Tech Stack)

### 前端 (Frontend)

| 類別 | 技術 |
|---|---|
| 框架 | React 19 + TypeScript |
| 建置工具 | Vite 8 |
| 樣式框架 | Tailwind CSS v4 |
| 編譯最佳化 | Babel Plugin React Compiler |
| 路由 | React Router v7 |
| HTTP Client | Axios |
| 套件管理 | pnpm |

### 後端 (Backend)

| 類別 | 技術 |
|---|---|
| 語言 | Python 3.14 |
| 框架 | Flask 3 |
| 套件管理 | uv |
| 認證 | JWT (PyJWT) |
| 密碼雜湊 | Argon2 |
| ORM | SQLAlchemy + Flask-SQLAlchemy |
| 資料庫遷移 | Flask-Migrate |
| 速率限制 | Flask-Limiter |
| 序列化 | Marshmallow |

### 基礎設施 (Infrastructure)

| 類別 | 技術 |
|---|---|
| 主資料庫 | PostgreSQL 16 |
| 快取與限流 | Redis 7 |
| 容器化 | Docker, Docker Compose |
| 版本控制 | Git, GitHub |

## 核心功能模組

1. **封閉式認證與授權 (Closed System Auth)** ✅ *已完成*
   - Admin-Approved 註冊機制: pending → admin 審批 → active
   - JWT 登入 (access_token 15min + refresh_token 7天)
   - RBAC 權限控管 (Admin / RuleMaker / User 角色)
   - 離線忘記密碼: admin 發臨時密碼 → 強制修改密碼
   - Rate Limiting + 帳號鎖定 (5 次失敗鎖 15 分鐘)
   - Audit Logs 稽核日誌
   - 隱藏 Admin 端點 (非 admin 回傳 404)

2. **智慧編碼規則樹 (Coding Rule Tree)** ✅ *已完成*
   - 支援多版本企業料號編碼原則
   - 採用 Adjacency List 資料庫設計（`rule_tree_categories` + `rule_tree_nodes`）
   - 節點支援四種欄位類型:
     - `options` — 欄位節點，從子節點選取選項（選擇集）
     - `option` — 子節點選項值
     - `input` — 使用者自行輸入文字（如流水號、容量值）
     - `fixed` — 自動帶入固定值（如無鹵產品 = `HF`）
   - Category 支援前綴碼（如電子材料 = `1`）
   - 料號格式模板: 16 碼，依材料類別有不同欄位結構
   - 綜合規則樹種子資料涵蓋: PCB板（9欄位）、電容器（9欄位）

3. **點選編碼 (Point-and-Click Coding)** ✅ *已完成*
   - 兩層式物料選擇精靈: 分類 → 材料群組 → 具體物料 → 依序填寫各欄位
   - 即時 PART NO. 預覽
   - 自動重複檢查（/check 端點）
   - buildPartNo 自動跳過空 code_segment 路徑節點
   - 已建立物料編碼規則:
     - PCB板（9 欄位: PCB材質/種類/板厚/銅厚/耐燃等級/氧化保護/流水號/HF/產地）
     - 電容器（9 欄位: 材料代號/電容種類/容量值/誤差值/溫度壽命/耐壓值/流水號/HF/產地）

4. **規則樹編輯器 (Rule Tree Editor)** ✅ *已完成*
   - 分類管理（新增/編輯/刪除，支援 prefix 前綴）
   - 節點 CRUD，支援巢狀樹狀結構
   - 四種欄位類型設定（options/option/input/fixed）
   - 父節點從完整路徑下拉選單選擇
   - **折疊/展開** — 有子節點的行可 ▼/▶ 切換
   - **樂觀更新** — 編輯/刪除直接修改 state，不重拉整棵樹
   - **內聯新增子節點** — hover 顯示 `＋` 按鈕，自動帶入 parent_id
   - **▲▼ 排序** — 每 row 可直接調整相鄰節點 sort_order
   - **sticky 表頭** — 捲動時表頭固定
   - **父節點排除自身** — 避免循環引用

5. **LLM 自動編碼** *(待開發)*
   - 透過微調 LLM 與 RAG 檢索技術自動生成 16 碼料號

## 專案目錄結構

```
erp-autocoder/
├── backend/               # Flask API (詳見 backend/README.md)
│   ├── app/               # 應用核心
│   │   ├── api/           # Blueprint (auth/, admin/, rule_tree/, encode/)
│   │   ├── models/        # User, Role, UserRole, AuditLog, RuleTreeCategory, RuleTreeNode, PartNumber
│   │   ├── services/      # 商業邏輯層
│   │   ├── decorators/    # @jwt_required, @admin_required, @rule_maker_required
│   │   └── utils/         # 工具函式
│   ├── seeds/             # flask seed (建立 Admin/RuleMaker/User 角色)
│   ├── main.py
│   └── pyproject.toml
│
├── frontend/              # Vite + React (詳見 frontend/README.md)
│   └── src/
│       ├── api/           # Axios 客戶端 + API 物件 (authApi, ruleTreeApi, encodeApi, adminApi)
│       ├── contexts/      # AuthContext
│       ├── guards/        # ProtectedRoute, AdminRoute, RuleMakerRoute
│       ├── pages/         # Login, Register, Dashboard, ChangePassword,
│       │   ├── admin/     # AdminLayout, UsersPage, PendingPage, AuditLogsPage, PasswordResetsPage
│       │   ├── rule_tree/ # RuleTreeEditorPage (規則樹 CRUD)
│       │   └── coding/    # CodingPage (表單精靈編碼), PartNumbersPage (已產生料號)
│       ├── routes/        # 路由定義
│       ├── types/         # TypeScript 型別
│       └── components/    # ui/ (Button, Card, Input)
│
├── Datasets/              # BOM 規則樹文件與樣本 CSV
│   ├── 電子材料編碼規則.txt
│   └── sample_*.csv
│
├── docker/                # Docker 配置檔
│   └── init.sql           # PostgreSQL 初始化腳本
│
├── Docs/                  # 開發與系統文件
│   ├── architecture.md
│   ├── database.md
│   ├── api.md
│   └── dev-guide.md
│
├── .env.example
├── docker-compose.yml
├── 我想建立一個erp自動編碼系統...txt  # 規格文件
└── README.md
```

## 快速開始 (Getting Started)

### 一鍵啟動 (Docker Compose — 完整系統)

```bash
# 1. 設定環境變數 (或直接使用預設值)
cp .env.example .env

# 2. 啟動所有服務 (db, redis, backend, frontend)
docker compose up -d --build

# 3. 執行 Database Seeding (僅首次需要)
docker compose exec backend flask seed

# 4. 匯入綜合編碼規則樹資料 (PCB板、電容器等完整欄位)
docker compose exec backend python seed_rules.py

# 5. 開啟瀏覽器
# http://localhost
```

> 預設管理員帳號: `admin` / `Admin_Initial_Password_9457`

### 本機開發 (Local Dev)

```bash
# 僅啟動基礎設施
docker compose up -d db redis

# 後端
cd backend
uv sync
uv run flask seed
uv run flask run --port 5000

# 前端
cd frontend
pnpm install
pnpm dev
```

瀏覽器開啟 `http://localhost:5173` 即可使用 (需搭配後端 API)。

## 開發文件

各項細節請參閱 `Docs/` 目錄下的文件：

- [系統架構](Docs/architecture.md)
- [資料庫設計](Docs/database.md)
- [API 端點](Docs/api.md)
- [開發指南](Docs/dev-guide.md)
