# Future Tasks (Phase 2+)

Based on the architectural guidelines in `01-ARCHITECTURE.md`, the following tasks are explicitly deferred to future phases:

## Architecture & Capabilities
- **Phase 2+**: Implement RAG (Retrieval-Augmented Generation) and integrate a vector database (e.g., Qdrant).
- **Phase 2+**: Introduce new ML models beyond the Phase 1 Prophet forecaster.
- **Phase 4**: Implement agentic AI architecture (orchestrator/agents), which may warrant extracting them into separate microservices.

## Scalability Upgrades
- **Database**: Add read replicas and connection pooling (e.g., PgBouncer).
- **ML Training**: Move from synchronous, in-process training to a background task queue (e.g., Celery + Redis).
- **File Uploads**: Migrate from local disk storage to object storage (e.g., AWS S3 or Google Cloud Storage).
- **LLM Calls**: Move from synchronous per-request calls to a Queue + async workers model.
- **Frontend**: Implement a CDN and edge caching.
- **Caching**: Integrate Redis for query result caching.

## Monitoring & Observability
- **Log Aggregation**: Add an external log aggregation tool by shipping `stdout` JSON logs to a collector.
- **External Monitoring**: Integrate tools like Prometheus, Grafana, or Sentry (explicitly excluded from Phase 1).

## Status update (2026-10)
Done in-process, with seams for the infrastructure upgrades above (none of that infrastructure was added):
- Training runs as a DB-backed background job (`JobRunner` protocol in `src/domain/interfaces/job_runner.py`; Celery/Redis can implement it).
- `/query` answers are cached in-process (`QueryCache` in `src/infrastructure/query_cache.py`; a Redis implementation can replace it).
- Uploads and model artifacts go through the `FileStorage` protocol (`src/domain/interfaces/file_storage.py`, local-disk implementation); the model registry JSON still lives on local disk.
- Prometheus `/metrics` and optional Sentry (`SENTRY_DSN`) exist; Grafana dashboards and log shipping do not.

Still out of scope: PgBouncer, read replicas, a CDN, and Redis/Celery themselves.
