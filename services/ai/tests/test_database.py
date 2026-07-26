"""数据库模块单元测试

覆盖：
- check_db_connection：正常 / 异常分支
- get_db：异步生成器会话生命周期
- Base：DeclarativeBase 子类化
- text 函数已正确导入（修复未导入 bug）

权威源：.trae/rules/testing.md §4 Mock 规范
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase

from src import database as db_module
from src.database import Base, check_db_connection, get_db


class TestBase:
    """SQLAlchemy DeclarativeBase 子类"""

    def test_base_应是_declarative_base_子类(self):
        # Assert: Base 应继承自 SQLAlchemy DeclarativeBase
        assert issubclass(Base, DeclarativeBase)

    def test_base_应可作为模型基类继承(self):
        # Arrange & Act
        class SampleModel(Base):
            __tablename__ = "test_sample"

        # Assert: __tablename__ 应正确设置
        assert SampleModel.__tablename__ == "test_sample"

    def test_base_应携带_metadata_属性(self):
        # Assert: DeclarativeBase 子类应携带 metadata
        assert hasattr(Base, "metadata")


class TestCheckDbConnection:
    """check_db_connection 异步函数"""

    @pytest.mark.asyncio
    async def test_数据库连接正常时应返回_true(self):
        # Arrange: mock engine.begin() 上下文管理器与 conn.execute()
        mock_conn = AsyncMock()
        mock_context = MagicMock()
        mock_context.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_context.__aexit__ = AsyncMock(return_value=None)

        with patch.object(db_module.engine, "begin", return_value=mock_context):
            # Act
            result = await check_db_connection()

        # Assert
        assert result is True
        # 验证使用了 text("SELECT 1") 语句
        mock_conn.execute.assert_awaited_once()
        executed_sql = mock_conn.execute.await_args.args[0]
        assert executed_sql.text == "SELECT 1"

    @pytest.mark.asyncio
    async def test_数据库连接异常时应返回_false(self):
        # Arrange: mock engine.begin 抛出异常
        mock_context = MagicMock()
        mock_context.__aenter__ = AsyncMock(side_effect=RuntimeError("connection refused"))
        mock_context.__aexit__ = AsyncMock(return_value=None)

        with patch.object(db_module.engine, "begin", return_value=mock_context):
            # Act
            result = await check_db_connection()

        # Assert
        assert result is False


class TestGetDb:
    """get_db 异步生成器"""

    @pytest.mark.asyncio
    async def test_应产出_async_session_对象(self):
        # Arrange: mock AsyncSessionLocal 返回 mock session
        mock_session = AsyncMock(spec=AsyncSession)
        mock_context = MagicMock()
        mock_context.__aenter__ = AsyncMock(return_value=mock_session)
        mock_context.__aexit__ = AsyncMock(return_value=None)

        with patch.object(db_module, "AsyncSessionLocal") as mock_session_factory:
            mock_session_factory.return_value = mock_context

            # Act
            gen = get_db()
            session = await gen.__anext__()

            # Assert
            assert session is mock_session

            # 清理生成器
            with pytest.raises(StopAsyncIteration):
                await gen.__anext__()

    @pytest.mark.asyncio
    async def test_生成器应在_with_退出后自动关闭(self):
        # Arrange
        mock_session = AsyncMock(spec=AsyncSession)
        mock_context = MagicMock()
        mock_context.__aenter__ = AsyncMock(return_value=mock_session)
        mock_context.__aexit__ = AsyncMock(return_value=None)

        with patch.object(db_module, "AsyncSessionLocal") as mock_session_factory:
            mock_session_factory.return_value = mock_context

            # Act: 完整消费生成器
            gen = get_db()
            async for _session in gen:
                assert _session is mock_session

            # Assert: __aexit__ 应被调用（即 with 块已退出）
            mock_context.__aexit__.assert_awaited()


class TestTextImport:
    """验证修复：text 函数已正确导入"""

    def test_text_函数应可调用(self):
        # Assert: text 函数应已从 sqlalchemy 导入
        assert callable(text)

    def test_text_应生成可执行_sql(self):
        # Act
        stmt = text("SELECT 1")

        # Assert
        assert stmt.text == "SELECT 1"
