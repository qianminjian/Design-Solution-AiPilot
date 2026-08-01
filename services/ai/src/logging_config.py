"""结构化日志配置

使用 python-json-logger 输出 JSON 格式日志，字段对齐 observability.md §1.2：
- timestamp / level / name / message / trace_id / test_run_id / service

trace_id / test_run_id 由 ContextFilter 自动注入（从 contextvar 读取）。
"""

import logging

from pythonjsonlogger import jsonlogger

from src.config import settings
from src.middleware.test_run_id import get_test_run_id
from src.middleware.trace import get_trace_id


class ContextFilter(logging.Filter):
    """日志 filter：注入 trace_id / test_run_id 字段到每条日志"""

    def filter(self, record: logging.LogRecord) -> bool:
        record.trace_id = get_trace_id() or "-"
        # P0-1.2 测试数据隔离：日志关联 test_run_id，便于 SLO 报表排除测试数据
        record.test_run_id = get_test_run_id() or "untracked"
        record.service = "ai"
        return True


def setup_logging() -> None:
    """初始化结构化日志

    在 FastAPI 启动时调用一次。生产环境固定 INFO，DEBUG 不进生产（observability.md §1.4）。
    """
    level = settings.log_level.upper()
    log_level = getattr(logging, level, logging.INFO)

    root_logger = logging.getLogger()
    # 清理已有 handler（避免重复输出）
    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    handler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter(
        "%(timestamp)s %(level)s %(name)s %(message)s %(service)s %(trace_id)s %(test_run_id)s",
        rename_fields={"timestamp": "timestamp", "level": "level", "name": "name"},
        timestamp=True,
    )
    formatter.default_time_format = "%Y-%m-%dT%H:%M:%S.%fZ"
    handler.setFormatter(formatter)
    handler.addFilter(ContextFilter())
    root_logger.addHandler(handler)
    root_logger.setLevel(log_level)

    # 降低第三方库噪音
    for noisy in ("httpx", "httpcore", "uvicorn.access"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
