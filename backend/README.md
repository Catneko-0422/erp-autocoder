# Backend — ERP 自動編碼系統後端 API

Python 3.14 + Flask 3 + SQLAlchemy + PostgreSQL 16

## 目錄結構

```
backend/
├── app/
│   ├── __init__.py              # create_app() factory + Blueprint registration
│   ├── config.py                # 設定檔（從 .env 讀取）
│   ├── extensions.py            # Flask extensions 初始化 (db, migrate, limiter)
│   ├── cli.py                   # flask seed CLI command
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   └── user.py              # User, Role, UserRole, AuditLog
│   │
│   ├── api/
│   │   ├── auth/
│   │   │   ├── __init__.py
│   │   │   └── routes.py        # register, login, refresh, change-password, me
│   │   └── admin/
│   │       ├── __init__.py
│   │       └── routes.py        # pending-users, approve, reject, issue-temp-pw, users, audit-logs
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   └── auth_service.py      # 所有認證商業邏輯 (register, login, refresh, change_password, etc.)
│   │
│   ├── decorators/
│   │   ├── __init__.py
│   │   └── auth.py              # @jwt_required, @admin_required, @optional_auth
│   │
│   └── utils/
│       ├── __init__.py
│       └── helpers.py           # success_response(), error_response()
│
├── seeds/
│   ├── __init__.py
│   └── seed.py                  # seed_database() — 建立 Role + Admin User
│
├── main.py                      # 應用程式入口
└── pyproject.toml
```

## 開發規範

### 新增一個 API 模組

1. 在 `app/api/` 下建立新目錄 `xxx/`
2. 建立 `routes.py` 撰寫端點（Schema 驗證直接使用 Marshmallow inline）
3. 在 `app/__init__.py` 註冊 Blueprint

### 商業邏輯

- 所有業務邏輯寫在 `app/services/` 中
- routes 只負責：解析請求 → 呼叫 service → 回傳回應
- Service 拋出 `AuthError(message, status_code)` 統一處理

### 權限控制

- `@jwt_required` — 需登入
- `@admin_required` — 需 Admin 角色（回傳 404 隱藏端點存在）
- `@optional_auth` — 有 token 就解析，沒有也可通行

## 啟動方式

### Docker (容器內執行)

```bash
docker compose up -d backend
docker compose exec backend flask seed
```

### 本機開發

```bash
uv sync
uv run flask seed
uv run flask run --port 5000
```

## API 端點

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | - | 註冊新使用者 (status=pending) |
| POST | `/api/auth/login` | - | 登入 (回傳 access + refresh token) |
| POST | `/api/auth/refresh` | - | 刷新 access_token |
| POST | `/api/auth/change-password` | JWT | 修改密碼 (must_change_password → false) |
| GET | `/api/auth/me` | JWT | 取得目前使用者資訊 |
| GET | `/api/admin/pending-users` | Admin | 待審核使用者列表 |
| POST | `/api/admin/approve-user/:id` | Admin | 核准使用者 |
| POST | `/api/admin/reject-user/:id` | Admin | 拒絕使用者 |
| POST | `/api/admin/issue-temp-password/:id` | Admin | 發放臨時密碼 |
| GET | `/api/admin/users?page=&per_page=` | Admin | 所有使用者列表 (翻頁) |
| PUT | `/api/admin/users/:id` | Admin | 更新使用者 (username, email, role) |
| DELETE | `/api/admin/users/:id` | Admin | 刪除使用者 (不可自刪) |
| GET | `/api/admin/audit-logs` | Admin | 稽核日誌 (最近 100 筆) |

## 相依套件

| 套件 | 用途 |
|------|------|
| Flask | Web 框架 |
| Flask-SQLAlchemy | ORM |
| Flask-Migrate | 資料庫遷移 |
| Flask-Limiter | Rate Limiting |
| PyJWT | JWT 產生與驗證 |
| argon2-cffi | 密碼雜湊 |
| marshmallow | 請求/回應序列化 |
| psycopg2-binary | PostgreSQL 驅動 |
| redis | Redis 客戶端 (預留) |
| python-dotenv | 環境變數載入 |
