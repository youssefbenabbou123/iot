from entities.user import User
from sqlalchemy.orm import Session


def create_user(session: Session, user: User):
    filtred_user = (
        session.query(User).filter(User.email == user.email).one_or_none()
    )
    if filtred_user is not None:
        return False
    session.add(user)
    try:
        session.commit()
        session.refresh(user)
        return True
    except Exception:
        session.rollback()
        return False


def get_user_by_email(session: Session, email: str):
    return session.query(User).filter(User.email == email).one_or_none()


def get_all_users(session: Session):
    return session.query(User).all()


def authenticate(session: Session, user: User):
    filtred_user: User = (
        session.query(User)
        .filter(
            User.email == user.email,
            User.password == user.password,
        )
        .one_or_none()
    )
    if filtred_user:
        return filtred_user
    return False

