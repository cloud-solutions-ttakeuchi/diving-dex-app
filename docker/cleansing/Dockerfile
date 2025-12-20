FROM python:3.11-slim

WORKDIR /app

COPY scripts/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY scripts/cleansing_pipeline.py scripts/
COPY src/data src/data/

ENV PYTHONUNBUFFERED=1

ENTRYPOINT ["python3", "-u", "scripts/cleansing_pipeline.py"]
