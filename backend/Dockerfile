FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libpq-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Single worker only. Two things assume one process and must change before adding
# --workers or running several replicas:
#   - the /query answer cache is per-process, so an upload or undo only clears it in
#     the process that handled it (src/infrastructure/query_cache.py);
#   - startup marks every queued/running training job failed, which would kill jobs
#     another process is still running (TrainingJobService.mark_stale_jobs_failed).
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
