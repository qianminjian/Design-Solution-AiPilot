"""日志配置模块单元测试

覆盖：
- TraceIdFilter.filter：注入 trace_id 与 service 字段
- setup_logging：root logger 配置（handler 清理、level 设置、第三方库降级）

权威源：.trae/rules/observability.md §1.2 结构化日志字段
"""
import logging
from unittest.mock import patch

import pytest

from src.logging_config import TraceIdFilter, setup_logging


class TestTraceIdFilter:
    """TraceIdFilter 日志过滤器"""

    def test_应在_record_注入_trace_id_与_service(self):
        # Arrange
        filter_ = TraceIdFilter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="hello",
            args=None,
            exc_info=None,
        )

        # Act
        result = filter_.filter(record)

        # Assert
        assert result is True
        assert hasattr(record, "trace_id")
        assert hasattr(record, "service")
        assert record.service == "ai"
        # 没有 trace_id 时应回退为 "-"
        assert record.trace_id == "-"

    def test_trace_id_存在时应注入真实值(self):
        # Arrange
        filter_ = TraceIdFilter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="hello",
            args=None,
            exc_info=None,
        )

        # Act: mock get_trace_id 返回真实 trace id
        with patch("src.logging_config.get_trace_id", return_value="trace-abc-123"):
            result = filter_.filter(record)

        # Assert
        assert result is True
        assert record.trace_id == "trace-abc-123"

    def test_filter_应始终返回_true(self):
        # Arrange
        filter_ = TraceIdFilter()
        record = logging.LogRecord(
            name="test",
            level=logging.WARNING,
            pathname="",
            lineno=0,
            msg="warn",
            args=None,
            exc_info=None,
        )

        # Act & Assert
        assert filter_.filter(record) is True


class TestSetupLogging:
    """setup_logging 初始化函数"""

    def test_应配置_root_logger_的_level(self):
        # Arrange: 保存原始状态
        root = logging.getLogger()
        original_level = root.level
        original_handlers = list(root.handlers)

        try:
            # Act
            with patch("src.logging_config.settings") as mock_settings:
                mock_settings.log_level = "WARNING"
                setup_logging()

            # Assert
            assert root.level == logging.WARNING
        finally:
            # 还原
            root.setLevel(original_level)
            for h in list(root.handlers):
                root.removeHandler(h)
            for h in original_handlers:
                root.addHandler(h)

    def test_无效_log_level_应回退到_INFO(self):
        # Arrange
        root = logging.getLogger()
        original_level = root.level
        original_handlers = list(root.handlers)

        try:
            # Act: mock settings 返回无效 level
            with patch("src.logging_config.settings") as mock_settings:
                mock_settings.log_level = "INVALID_LEVEL"
                setup_logging()

            # Assert: getattr 回退到 INFO
            assert root.level == logging.INFO
        finally:
            root.setLevel(original_level)
            for h in list(root.handlers):
                root.removeHandler(h)
            for h in original_handlers:
                root.addHandler(h)

    def test_应清理已有_handler_后添加单一_handler(self):
        # Arrange
        root = logging.getLogger()
        original_level = root.level
        original_handlers = list(root.handlers)

        # 预添加 2 个 dummy handler
        for _ in range(2):
            root.addHandler(logging.StreamHandler())

        try:
            # Act
            with patch("src.logging_config.settings") as mock_settings:
                mock_settings.log_level = "INFO"
                setup_logging()

            # Assert: 应只剩 1 个 handler（清理后添加的）
            assert len(root.handlers) == 1
            assert isinstance(root.handlers[0], logging.StreamHandler)
        finally:
            root.setLevel(original_level)
            for h in list(root.handlers):
                root.removeHandler(h)
            for h in original_handlers:
                root.addHandler(h)

    def test_handler_应携带_TraceIdFilter(self):
        # Arrange
        root = logging.getLogger()
        original_level = root.level
        original_handlers = list(root.handlers)

        try:
            # Act
            with patch("src.logging_config.settings") as mock_settings:
                mock_settings.log_level = "INFO"
                setup_logging()

            # Assert
            handler = root.handlers[0]
            assert any(isinstance(f, TraceIdFilter) for f in handler.filters)
        finally:
            root.setLevel(original_level)
            for h in list(root.handlers):
                root.removeHandler(h)
            for h in original_handlers:
                root.addHandler(h)

    def test_应降低第三方库日志噪音(self):
        # Arrange
        root = logging.getLogger()
        original_level = root.level
        original_handlers = list(root.handlers)
        original_httpx_level = logging.getLogger("httpx").level
        original_httpcore_level = logging.getLogger("httpcore").level
        original_uvicorn_access_level = logging.getLogger(
            "uvicorn.access"
        ).level

        try:
            # Act
            with patch("src.logging_config.settings") as mock_settings:
                mock_settings.log_level = "INFO"
                setup_logging()

            # Assert: 第三方库应被设置为 WARNING
            assert logging.getLogger("httpx").level == logging.WARNING
            assert logging.getLogger("httpcore").level == logging.WARNING
            assert logging.getLogger("uvicorn.access").level == logging.WARNING
        finally:
            root.setLevel(original_level)
            for h in list(root.handlers):
                root.removeHandler(h)
            for h in original_handlers:
                root.addHandler(h)
            logging.getLogger("httpx").setLevel(original_httpx_level)
            logging.getLogger("httpcore").setLevel(original_httpcore_level)
            logging.getLogger("uvicorn.access").setLevel(
                original_uvicorn_access_level
            )
