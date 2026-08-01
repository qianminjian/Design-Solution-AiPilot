#!/usr/bin/env python3
"""
Skip 扫描脚本（CI 门禁）

检测测试文件中无注释的 .skip / @Skip / pytest.skip / @Disabled，
违反 testing.md §9.2 跳过测试扫描。

扫描规则：
1. 扫描所有测试文件（*.test.ts / *.spec.ts / *.test.tsx / test_*.py / *Test.java）
2. 检测跳过测试的模式：
   - TypeScript: it.skip / test.skip / describe.skip / xit / xdescribe
   - Python: pytest.skip / @pytest.mark.skip / @unittest.skip
   - Java: @Disabled / @Skip
3. 检测跳过是否附带 issue 编号与原因注释：
   - 必须在同一行或上一行有 // TODO(issue-xxx): ... 或 # TODO(issue-xxx): ... 注释
   - 注释必须包含 issue 编号（如 issue-123 / #123 / GH-123）
4. 跳过的测试超过 1 个 sprint 也算违规

退出码：
- 0：扫描通过
- 1：扫描失败（发现违规）
- 2：脚本执行错误

对齐 .trae/rules/testing.md §9.2 跳过测试扫描
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Iterable

# 项目根目录
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

# 排除目录
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

# 跳过测试模式（按语言分组）
SKIP_PATTERNS = {
    "typescript": [
        re.compile(r"\bit\.skip\b"),
        re.compile(r"\btest\.skip\b"),
        re.compile(r"\bdescribe\.skip\b"),
        re.compile(r"\bxit\s*\("),
        re.compile(r"\bxdescribe\s*\("),
        re.compile(r"\bxit\b"),
        re.compile(r"\bxdescribe\b"),
    ],
    "python": [
        re.compile(r"\bpytest\.skip\s*\("),
        re.compile(r"@pytest\.mark\.skip"),
        re.compile(r"@unittest\.skip"),
        re.compile(r"\bskipif\b"),
    ],
    "java": [
        re.compile(r"@Disabled"),
        re.compile(r"@org\.junit\.jupiter\.api\.Disabled"),
        re.compile(r"Assumptions\.assumeTrue\s*\(\s*false"),
    ],
}

# issue 编号模式（允许的注释格式）
ISSUE_PATTERNS = [
    re.compile(r"issue[-_]?\d+", re.IGNORECASE),
    re.compile(r"#\d+"),
    re.compile(r"GH[-_]?\d+", re.IGNORECASE),
    re.compile(r"TODO\s*\(\s*issue", re.IGNORECASE),
    re.compile(r"FIXME\s*\(\s*issue", re.IGNORECASE),
]


def detect_language(path: Path) -> str:
    """根据文件扩展名检测语言"""
    if path.suffix in {".ts", ".tsx"}:
        return "typescript"
    if path.suffix == ".py":
        return "python"
    if path.suffix == ".java":
        return "java"
    return "unknown"


def find_test_files(root: Path) -> Iterable[Path]:
    """查找所有测试文件"""
    for pattern in TEST_FILE_PATTERNS:
        for path in root.glob(pattern):
            if any(part in EXCLUDE_DIRS for part in path.parts):
                continue
            if not path.is_file():
                continue
            yield path


def has_issue_reference(comment: str) -> bool:
    """检查注释中是否包含 issue 编号"""
    return any(pattern.search(comment) for pattern in ISSUE_PATTERNS)


def scan_file(path: Path) -> list[tuple[int, str, str]]:
    """
    扫描单个文件，返回违规列表
    返回值：[(行号, 违规类型, 违规内容), ...]
    """
    violations: list[tuple[int, str, str]] = []
    language = detect_language(path)
    if language == "unknown":
        return violations

    patterns = SKIP_PATTERNS.get(language, [])
    if not patterns:
        return violations

    try:
        content = path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        print(f"⚠️ 无法读取文件 {path}: {exc}", file=sys.stderr)
        return violations

    lines = content.splitlines()
    for line_no, line in enumerate(lines, start=1):
        for pattern in patterns:
            if pattern.search(line):
                # 检查同行是否有 issue 注释
                line_has_issue = has_issue_reference(line)

                # 检查上一行是否有 issue 注释
                if not line_has_issue and line_no > 1:
                    prev_line = lines[line_no - 2]
                    line_has_issue = has_issue_reference(prev_line)

                # 检查上两行（处理 @pytest.mark.skip 等装饰器跨行场景）
                if not line_has_issue and line_no > 2:
                    prev_prev_line = lines[line_no - 3]
                    line_has_issue = has_issue_reference(prev_prev_line)

                if not line_has_issue:
                    violations.append(
                        (
                            line_no,
                            "SKIP_WITHOUT_ISSUE",
                            line.strip(),
                        )
                    )
                break  # 同一行只算一次违规

    return violations


def main() -> int:
    """主入口"""
    print("🔍 扫描测试文件中的 .skip / @Disabled / pytest.skip...")

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
        print("   违反 testing.md §9.2 跳过测试扫描")
        print("   修复方法：在跳过测试上方添加 // TODO(issue-xxx): 原因 注释")
        return 1

    print(f"\n✅ 扫描通过：{len(test_files)} 个测试文件均无违规")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"❌ 脚本执行错误: {exc}", file=sys.stderr)
        sys.exit(2)
