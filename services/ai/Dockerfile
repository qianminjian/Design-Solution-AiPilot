# AI Service Dockerfile — Python 3.12 + FastAPI（国内镜像加速）
FROM python:3.12-slim

WORKDIR /app

# 使用阿里云 PyPI 镜像加速
RUN pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/ && \
    pip config set global.trusted-host mirrors.aliyun.com

COPY pyproject.toml .
# 安装核心依赖 + RAG 可选依赖（sentence-transformers 用于本地向量化）
RUN pip install --no-cache-dir . && \
    pip install --no-cache-dir "sentence-transformers>=2.7,<3"

# 创建 appuser 并切换（预下载模型前切换，确保缓存归 appuser 所有）
RUN useradd --create-home --shell /bin/bash appuser && \
    chown -R appuser:appuser /app
USER appuser

# 预下载 all-MiniLM-L6-v2 模型权重到 /app/models/ 目录
# 容器内运行时通过 EMBEDDING_MODEL_PATH=/app/models/all-MiniLM-L6-v2 直接加载，绕过 huggingface_hub 缓存
# 国内构建时使用 hf-mirror.com 镜像加速；构建网络不佳时跳过（部署后可手动 docker cp 补齐）
ENV HF_ENDPOINT=https://hf-mirror.com
# 注意：Python 代码必须写成单行（以 from 开头的行会被 Docker 解析器误判为 FROM 指令）
RUN mkdir -p /app/models && \
    python3 -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='sentence-transformers/all-MiniLM-L6-v2', local_dir='/app/models/all-MiniLM-L6-v2'); print('Model downloaded to /app/models/all-MiniLM-L6-v2')" || echo "model preload skipped (will docker cp on deploy)"

# 运行时强制离线模式（容器内无法访问 huggingface.co / hf-mirror.com）
ENV HF_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1
# 默认 embedding 模型路径（容器内预下载）
ENV EMBEDDING_MODEL_PATH=/app/models/all-MiniLM-L6-v2

COPY --chown=appuser:appuser src/ src/

EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
