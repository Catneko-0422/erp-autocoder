# 系統架構 (System Architecture)

## 整體架構概覽

```
┌─────────────────────────────────────────────────────┐
│                   使用者瀏覽器                         │
│         React 19 + TypeScript + Vite 8              │
│         http://localhost:5173                       │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP (JSON)
                       │ JWT Token in Authorization Header
                       ▼
┌─────────────────────────────────────────────────────┐
│                Flask API (Gunicorn/Werkzeug)         │
│         http://localhost:5000                        │
│                                                      │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌────────┐│
│  │  Auth   │  │  Admin  │  │Rule Tree │  │ Encode ││
│  │Blueprint│  │Blueprint│  │Blueprint │  │Blueprint││
│  └────┬────┘  └────┬────┘  └────┬─────┘  └───┬────┘│
│       │            │            │             │      │
│  ┌────▼────────────▼────────────▼─────────────▼──┐  │
│  │              Services Layer                   │  │
│  │  auth_service, audit_service, rule_service,   │  │
│  │  encode_service                               │  │
│  └────┬────────────┬─────────────────────────────┘  │
│       │            │                                  │
│  ┌────▼────────────▼──────────────────────┐          │
│  │         SQLAlchemy ORM                 │          │
│  │   models: User, Role, AuditLog,       │          │
│  │   RuleTreeCategory, RuleTreeNode,      │          │
│  │   PartNumber                           │          │
│  └────┬───────────────────────────────────┘          │
└───────┼──────────────────────────────────────────────┘
        │
        ├───────────────────────────────────┐
        ▼                                   ▼
┌───────────────┐                 ┌───────────────┐
│  PostgreSQL   │                 │    Redis      │
│   Port 5432   │                 │   Port 6379   │
│               │                 │               │
│  - roles      │                 │  - Rate Limit │
│  - users      │                 │  - Cache      │
│  - user_roles │                 │  - Sessions   │
│  - audit_logs │                 └───────────────┘
│  - rule_tree_ │
│    categories │
│  - rule_tree_ │
│    nodes      │
│  - part_numbers│
└───────────────┘
```

## 認證流程 (Authentication Flow)

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│ Frontend │         │  Backend │         │ Database │
└────┬─────┘         └────┬─────┘         └────┬─────┘
     │  POST /api/auth/    │                    │
     │  login              │                    │
     │ {username,password} │                    │
     ├────────────────────►│ 查詢使用者         │
     │                     ├───────────────────►│
     │                     │◄───────────────────┤
     │                     │ 驗證密碼 + 檢查    │
     │                     │ status, lockout    │
     │  {access_token,     │                    │
     │   refresh_token,    │                    │
     │   must_change_pw}   │                    │
     │◄────────────────────┤                    │
     │                     │                    │
     │  儲存 token         │                    │
     │  (memory/localStorage)                   │
     │                     │                    │
     │  所有後續請求帶      │                    │
     │  Authorization:     │                    │
     │  Bearer <token>     │                    │
     ├────────────────────►│ 驗證 JWT           │
     │                     │ 查 RBAC 權限       │
     │                     │ 處理請求           │
```

## 目錄設計原則

### 後端 — Blueprint 模組化

每個業務域是一個獨立的 Flask Blueprint：

```
app/api/
├── auth/              # 認證模組
├── admin/             # 管理員功能
├── rule_tree/         # 編碼規則樹 CRUD
├── encode/            # 料號編碼與檢查
└── llm/               # 未來：LLM 自動編碼
```

各模組間透過 Service Layer 共用商業邏輯，不直接依賴彼此。

### 前端 — Role-based Routing

前端不分 Admin/User 兩套程式碼，而是透過 `AuthContext` 儲存的使用者角色決定：

- 路由守衛 (`ProtectedRoute`, `AdminRoute`, `RuleMakerRoute`) 控制頁面存取
- Admin 頁面集中在 `pages/admin/` 子目錄，便於管理
- 規則樹編輯與編碼頁面分別在 `pages/rule_tree/` 與 `pages/coding/`
