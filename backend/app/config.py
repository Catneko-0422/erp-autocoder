import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-change-in-production')
    SQLALCHEMY_DATABASE_URI = os.getenv(
        'DATABASE_URL',
        'postgresql://erp_user:erp_pass@localhost:5432/erp_db',
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    JWT_SECRET = os.getenv('JWT_SECRET', SECRET_KEY)
    JWT_ACCESS_EXPIRES = 900       # 15 min
    JWT_REFRESH_EXPIRES = 604800   # 7 days

    REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

    RATELIMIT_ENABLED = True
    RATELIMIT_STORAGE_URL = os.getenv('RATELIMIT_STORAGE_URL', 'memory://')

    MAX_LOGIN_ATTEMPTS = 5
    LOCKOUT_MINUTES = 15

    ADMIN_USERNAME = os.getenv('ADMIN_USERNAME', 'admin')
    ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', 'admin@erp.local')
    ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'Admin123!')

    ALLOWED_ADMIN_IPS = os.getenv('ALLOWED_ADMIN_IPS', '')

    OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', '')
    OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'gemma4:latest')
    OLLAMA_TIMEOUT = os.getenv('OLLAMA_TIMEOUT', '120')
