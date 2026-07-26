# AI Service Dockerfile — Python 3.12 + FastAPI（国内镜像加速）
FROM python:3.12-slim

WORKDIR /app

# 使用阿里云 PyPI 镜像加速
RUN pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/ && \
    pip config set global.trusted-host mirrors.aliyun.com

COPY pyproject.toml .
RUN pip install --no-cache-dir .

COPY src/ src/

RUN useradd --create-home --shell /bin/bash appuser && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
