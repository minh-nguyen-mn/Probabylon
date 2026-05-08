FROM python:3.11-slim

WORKDIR /app
COPY services/api/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
COPY services/api /app
COPY services/worker /app/worker

EXPOSE 8000
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "-w", "2", "app.main:app", "--bind", "0.0.0.0:8000"]
