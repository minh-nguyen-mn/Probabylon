FROM python:3.11-slim

WORKDIR /app
COPY services/api/requirements.txt /app/requirements-api.txt
COPY services/worker/requirements.txt /app/requirements-worker.txt
RUN pip install --no-cache-dir -r /app/requirements-api.txt -r /app/requirements-worker.txt
COPY services/api /app
COPY services/worker /app/worker

CMD ["celery", "-A", "worker.tasks", "worker", "--loglevel=INFO", "--concurrency=8"]
