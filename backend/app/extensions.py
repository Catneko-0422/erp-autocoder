import os
import json
import redis as _redis

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

db = SQLAlchemy()
migrate = Migrate()
limiter = Limiter(key_func=get_remote_address)

_redis_pool = None


def get_redis():
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = _redis.ConnectionPool.from_url(
            os.getenv('REDIS_URL', 'redis://localhost:6379/0'),
            decode_responses=True,
        )
    return _redis.Redis(connection_pool=_redis_pool)


def cache_get(key: str):
    r = get_redis()
    val = r.get(key)
    return json.loads(val) if val else None


def cache_set(key: str, value, ttl: int = 300):
    r = get_redis()
    r.setex(key, ttl, json.dumps(value, default=str))


def cache_delete(key: str):
    r = get_redis()
    r.delete(key)


CACHE_KEY_TREE = 'rule_tree:full'
