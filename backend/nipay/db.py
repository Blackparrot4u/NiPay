from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


def make_engine(url: str):
    kw = {}
    if url.startswith("sqlite"):
        kw["connect_args"] = {"check_same_thread": False, "timeout": 30}
        kw["isolation_level"] = None  # we issue BEGIN ourselves, see below
    eng = create_engine(url, **kw)
    if url.startswith("sqlite"):
        @event.listens_for(eng, "connect")
        def _pragmas(conn, _rec):
            cur = conn.cursor()
            cur.execute("PRAGMA journal_mode=WAL")
            cur.execute("PRAGMA foreign_keys=ON")
            cur.execute("PRAGMA synchronous=NORMAL")
            cur.close()

        @event.listens_for(eng, "begin")
        def _begin(conn):
            # BEGIN IMMEDIATE takes the write lock up front, so a read-modify-write on the
            # ledger can never interleave with another writer. Postgres uses row locks instead.
            conn.exec_driver_sql("BEGIN IMMEDIATE")
    return eng


def make_session_factory(engine):
    return sessionmaker(bind=engine, expire_on_commit=False)
