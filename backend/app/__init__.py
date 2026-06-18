from flask import Flask
from flask_cors import CORS
from .config import Config
from .extensions import db, migrate, limiter


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    CORS(app, resources={r"/api/*": {"origins": "*"}})

    db.init_app(app)
    migrate.init_app(app, db)
    limiter.init_app(app)

    from .api.auth.routes import auth_bp
    from .api.admin.routes import admin_bp
    from .api.rule_tree.routes import rule_tree_bp
    from .api.encode.routes import encode_bp
    from .api.auto_encode.routes import auto_encode_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(rule_tree_bp, url_prefix='/api/rule-tree')
    app.register_blueprint(encode_bp, url_prefix='/api/encode')
    app.register_blueprint(auto_encode_bp, url_prefix='/api/auto-encode')

    from .cli import seed_command
    app.cli.add_command(seed_command)

    return app
