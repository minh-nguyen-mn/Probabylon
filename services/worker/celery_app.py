from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "probabylon_worker",
    broker=settings.broker_url,
    backend=settings.result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    task_track_started=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)
