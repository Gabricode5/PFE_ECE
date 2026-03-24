# Backend Changes

## models.py

Added one column to the `KnowledgeBase` table:

```python
source = Column(String(500), nullable=True)
```

Stores where each chunk came from — either a URL (e.g. `https://...`) or a filename (e.g. `test_knowledge.txt`).

---

## migrate.py

Added `ensure_knowledge_base_source_column()` — a safe migration that runs:

```sql
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS source VARCHAR(500)
```

on an existing database without losing data.

---

## requirements.txt

Added two packages:

- **`python-docx`** — extracts text from `.docx` Word files
- **`pypdf`** — extracts text from `.pdf` PDF files

---

## ingest_postgres.py

Added `ingest_file_to_postgres(file_bytes, filename, category)`:

- Accepts raw file bytes + filename
- Dispatches by extension:
  - **`.txt`** → decode UTF-8 (fallback latin-1)
  - **`.docx`** → `python-docx` extracts paragraph text
  - **`.pdf`** → `pypdf` extracts page text
- Reuses the same pipeline as URL ingestion: sanitize → chunk (1000 chars, 100 overlap) → embed via Mistral → insert into `knowledge_base` with `source=filename`
- Added `logging` throughout: raw text length, chunk count, rows inserted

---

## main.py

### New endpoints

**`POST /knowledge-base/ingest-file`**
Receives a file upload (`UploadFile`) + optional `category` form field, validates extension (txt/docx/pdf only), launches `ingest_file_to_postgres` as a `BackgroundTask`, returns a `job_id` for polling.

**`GET /knowledge-base/sources`**
Queries the DB and groups rows by `(source, category)`, returning each unique source with its chunk count and date. Used by the frontend to display indexed sources.

**`DELETE /knowledge-base/sources?source=...`**
Deletes all chunks belonging to a given source from the DB. Used by the delete button on each source card in the frontend.

### Logging

Added `logging.basicConfig` at startup and `logger.info/error` calls on every ingest request, job start, completion, and failure.
