#!/usr/bin/env python3
"""
为 D37 每个页面规格表添加"原型参考"行
"""

import re

FILE_PATH = "/Users/minjianq/Documents/66-Project/trae-project/Design-Solution-AiPilot/design/D37-关键界面-交互状态.md"

PAGE_MAP = [
    ("P01", "my-work.html"),
    ("P02", "project-home.html"),
    ("P03", "requirements.html"),
    ("P04", "cde-library.html"),
    ("P05", "viewer.html"),
    ("P06", "design-options.html"),
    ("P07", "coordination.html"),
    ("P08", "rule-check.html"),
    ("P09", "ai-review.html"),
    ("P10", "engineering.html"),
    ("P11", "publish.html"),
    ("P12", "change-impact.html"),
]


def main():
    with open(FILE_PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()

    page_idx = 0
    result = []
    i = 0

    while i < len(lines):
        line = lines[i]
        result.append(line)

        # 检测每个页面的"可访问性"行，且下一行是空行或下一节标题
        if line.strip().startswith("| 可访问性 |") and page_idx < len(PAGE_MAP):
            # 检查是否在页面规格表内（下一行是空行或下一节）
            next_line = lines[i + 1] if i + 1 < len(lines) else ""
            if next_line.strip() == "" or next_line.strip().startswith("### D37."):
                page_code, proto_file = PAGE_MAP[page_idx]
                proto_line = f"| 原型参考 | `design-ui-system/pages/{proto_file}` |\n"
                result.append(proto_line)
                print(f"  ✓ {page_code} → {proto_file}")
                page_idx += 1

        i += 1

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.writelines(result)

    print(f"\n完成！共添加 {page_idx} 个原型参考行")


if __name__ == "__main__":
    main()