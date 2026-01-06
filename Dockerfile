FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt
COPY . /app
ENV MODEL_PATH=/app/outputs/model.joblib
ENV BASE_CUSTOMERS_CSV=/app/outputs/customers_base.csv
ENV PYTHONPATH=/app
RUN python scripts/run_demo.py
EXPOSE 8004
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8004"]
