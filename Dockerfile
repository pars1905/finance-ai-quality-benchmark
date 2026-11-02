FROM python:3.12-slim
WORKDIR /app
COPY finance_benchmark/ finance_benchmark/
COPY data/ data/
COPY examples/ examples/
CMD ["python", "-m", "finance_benchmark", "run", "--provider", "baseline"]
