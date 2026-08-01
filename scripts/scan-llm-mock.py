#!/usr/bin/env python3
"""
LLM Mock 扫描脚本（CI 门禁）

检测测试文件中是否包含真实付费 LLM API 调用，违反 testing.md §4.2 LLM 调用 Mock 红线。

扫描规则：
1. 扫描所有测试文件（*.test.ts / *.spec.ts / *.test.tsx / test_*.py / *Test.java）
2. 检测是否包含真实付费 API URL：
   - api.openai.com
   - api.anthropic.com
   - api.eviai.com
   - api.xiaoku.com
   - api.jianzhuxuezhang.com
3. 检测是否包含真实 LLM API Key（sk- 前缀且长度 ≥ 30）
4. 检测是否直接实例化真实 LLM 客户端（OpenAI() / Anthropic()）

退出码：
- 0：扫描通过（无违规）
- 1：扫描失败（发现违规）
- 2：脚本执行错误

对齐 .trae/rules/testing.md §4.2 LLM 调用 Mock 红线
对齐 .trae/rules/security.md §13 CI 安全门禁
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Iterable

# 项目根目录（脚本位于 scripts/ 下）
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# 测试文件 glob 模式
TEST_FILE_PATTERNS = [
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.spec.ts",
    "**/*.spec.tsx",
    "**/test_*.py",
    "**/*_test.py",
    "**/*Test.java",
    "**/*IT.java",
]

# 排除目录（不扫描）
EXCLUDE_DIRS = {
    "node_modules",
    ".next",
    "dist",
    "build",
    "target",
    ".git",
    ".cache",
    "coverage",
    "htmlcov",
    "__pycache__",
    ".venv",
    "venv",
}

# 真实付费 LLM API URL（命中即报错）
LLM_API_URL_PATTERNS = [
    r"https?://api\.openai\.com",
    r"https?://api\.anthropic\.com",
    r"https?://api\.eviai\.com",
    r"https?://api\.xiaoku\.com",
    r"https?://api\.jianzhuxuezhang\.com",
    r"https?://api\.deepseek\.com",
    r"https?://api\.moonshot\.cn",
    r"https?://api\.bailian\.aliyuncs\.com",
]

# 真实 LLM API Key 模式（sk- 前缀 + 长度 ≥ 30）
LLM_API_KEY_PATTERN = re.compile(
    r"""["']sk-[a-zA-Z0-9\-_]{30,}["']"""
)

# 直接实例化真实 LLM 客户端的模式
LLM_CLIENT_INSTANTIATION_PATTERNS = [
    # Python: from openai import OpenAI; OpenAI(api_key=...)
    re.compile(r"\bOpenAI\s*\("),
    re.compile(r"\bAnthropic\s*\("),
    # TypeScript: new OpenAI(...)
    re.compile(r"\bnew\s+OpenAI\s*\("),
    re.compile(r"\bnew\s+Anthropic\s*\("),
]

# Mock 引用模式（这些是允许的，不算违规）
ALLOWED_MOCK_PATTERNS = [
    # vi.mock('@/services/llm-client')
    re.compile(r"vi\.mock\s*\("),
    # @patch('src.services.llm_client.generate_design')
    re.compile(r"@patch\s*\("),
    # mockResolvedValue / mockReturnValue / MagicMock
    re.compile(r"\bmockResolvedValue\b"),
    re.compile(r"\bmockReturnValue\b"),
    re.compile(r"\bMagicMock\b"),
    re.compile(r"\bAsyncMock\b"),
    # from unittest.mock import ...
    re.compile(r"from\s+unittest\.mock\s+import"),
    # vi.fn()
    re.compile(r"\bvi\.fn\s*\(\s*\)"),
]


def find_test_files(root: Path) -> Iterable[Path]:
    """查找所有测试文件"""
    for pattern in TEST_FILE_PATTERNS:
        for path in root.glob(pattern):
            # 排除隐藏目录和构建目录
            if any(part in EXCLUDE_DIRS for part in path.parts):
                continue
            if not path.is_file():
                continue
            yield path


def scan_file(path: Path) -> list[tuple[int, str, str]]:
    """
    扫描单个文件，返回违规列表
    返回值：[(行号, 违规类型, 违规内容), ...]
    """
    violations: list[tuple[int, str, str]] = []
    try:
        content = path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        print(f"⚠️ 无法读取文件 {path}: {exc}", file=sys.stderr)
        return violations

    lines = content.splitlines()
    for line_no, line in enumerate(lines, start=1):
        # 跳过注释行（避免误报）
        stripped = line.strip()
        if stripped.startswith("//") or stripped.startswith("#") or stripped.startswith("*"):
            continue

        # 检测真实付费 LLM API URL
        for url_pattern in LLM_API_URL_PATTERNS:
            if re.search(url_pattern, line):
                violations.append((line_no, "LLM_API_URL", line.strip()))
                break

        # 检测真实 LLM API Key
        if LLM_API_KEY_PATTERN.search(line):
            violations.append((line_no, "LLM_API_KEY", line.strip()))

        # 检测直接实例化真实 LLM 客户端（但允许在 mock 引用中使用）
        for pattern in LLM_CLIENT_INSTANTIATION_PATTERNS:
            if pattern.search(line):
                # 检查是否在 mock 上下文中
                is_mock_context = any(
                    mock_pat.search(line) for mock_pat in ALLOWED_MOCK_PATTERNS
                )
                # 如果整行不含 mock 关键字，且不是 mock 定义本身，则违规
                if not is_mock_context:
                    violations.append(
                        (line_no, "LLM_CLIENT_INSTANTIATION", line.strip())
                    )


def main() -> int:
    """主入口"""
    print("🔍 扫描测试文件中的真实付费 LLM API 调用...")

    test_files = list(find_test_files(PROJECT_ROOT))
    if not test_files:
        print("ℹ️  未找到测试文件")
        return 0

    print(f"📋 扫描 {len(test_files)} 个测试文件")

    total_violations = 0
    for path in test_files:
        violations = scan_file(path)
        if violations:
            rel_path = path.relative_to(PROJECT_ROOT)
            print(f"\n❌ {rel_path}:")
            for line_no, violation_type, content in violations:
                print(f"  L{line_no} [{violation_type}] {content}")
                total_violations += 1

    if total_violations > 0:
        print(f"\n❌ 扫描失败：发现 {total_violations} 处违规")
        print("   违反 testing.md §4.2 LLM 调用 Mock 红线")
        print("   修复方法：使用 vi.mock / @patch / MagicMock 替换真实 LLM 调用")
        return 1

    print(f"\n✅ 扫描通过：{len(test_files)} 个测试文件均无违规")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"❌ 脚本执行错误: {exc}", file=sys.stderr)
        sys.exit(2)
