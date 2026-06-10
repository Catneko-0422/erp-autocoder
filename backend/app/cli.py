import click
from flask.cli import with_appcontext
from .extensions import db
from .models.user import Role


@click.command('seed')
@with_appcontext
def seed_command():
    from seeds.seed import seed_database
    seed_database(db)
    click.echo('Database seeded.')
