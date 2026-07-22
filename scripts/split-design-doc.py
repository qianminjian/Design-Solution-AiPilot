#!/usr/bin/env python3
"""
设计文档拆分脚本 - 将 deep-research-report.md 按 D01-D46 章节拆分为独立文件
"""

import os

DESIGN_DIR = "/Users/minjianq/Documents/66-Project/trae-project/Design-Solution-AiPilot/design"
SOURCE_FILE = os.path.join(DESIGN_DIR, "deep-research-report.md")

# 章节定义：(编号, 标题, 起始行, 结束行)
# 结束行是下一章节起始行 - 1
CHAPTERS = [
    ("D00", "执行摘要与初稿保留区", 1, 998),
    ("D01", "产品目标、范围与术语基线", 999, 1398),
    ("D02", "版本路线与场景优先级", 1399, 1713),
    ("D03", "企业级业务能力地图", 1714, 2133),
    ("D04", "角色、组织与权限模型", 2134, 2408),
    ("D05", "全流程阶段与阶段门", 2409, 2749),
    ("D06", "需求与信息要求模块", 2750, 3027),
    ("D07", "CDE领域与版本模型", 3028, 3271),
    ("D08", "项目、计划与任务编排", 3272, 3547),
    ("D09", "概念设计模块", 3548, 3790),
    ("D10", "方案设计模块", 3791, 4013),
    ("D11", "扩初设计模块", 4014, 4232),
    ("D12", "建筑施工图模块", 4233, 4520),
    ("D13", "结构专业模块", 4521, 4708),
    ("D14", "给排水专业模块", 4709, 4898),
    ("D15", "暖通专业模块", 4899, 5109),
    ("D16", "电气专业模块", 5110, 5323),
    ("D17", "景观室内与专项专业扩展模型", 5324, 5505),
    ("D18", "多专业模型联邦", 5506, 5743),
    ("D19", "碰撞检测与问题闭环", 5744, 6036),
    ("D20", "规范知识与RAG", 6037, 6369),
    ("D21", "规则与合规检查", 6370, 6677),
    ("D22", "图纸与模型一致性校验", 6678, 6927),
    ("D23", "工程量材料与成本辅助", 6928, 7190),
    ("D24", "AI能力目录与网关", 7191, 7520),
    ("D25", "视觉OCR与图纸理解", 7521, 7778),
    ("D26", "生成式与参数化设计", 7779, 8055),
    ("D27", "Agent与工具调用治理", 8056, 8329),
    ("D28", "AI与ML生命周期与评测", 8330, 8676),
    ("D29", "CADBIM桌面连接器框架", 8677, 8947),
    ("D30", "Revit与APS集成", 8948, 9252),
    ("D31", "AutoCAD与DWG集成", 9253, 9537),
    ("D32", "RhinoSketchUp与ArchiCAD集成", 9538, 9821),
    ("D33", "GIS仿真与工程软件集成", 9822, 10169),
    ("D34", "数据模型与数据库设计", 10170, 10673),
    ("D35", "API与事件契约", 10674, 11191),
    ("D36", "界面信息架构", 11192, 11497),
    ("D37", "关键界面与交互状态", 11498, 11937),
    ("D38", "通知与协作", 11938, 12265),
    ("D39", "身份多租户与授权", 12266, 12699),
    ("D40", "安全隐私与威胁模型", 12700, 13175),
    ("D41", "审计与电子证据", 13176, 13581),
    ("D42", "非功能与容量模型", 13582, 14070),
    ("D43", "可观测性与运营分析", 14071, 14529),
    ("D44", "部署网络与环境拓扑详细设计", 14530, 15020),
    ("D45", "测试与验收体系详细设计", 15021, 15477),
    ("D46", "设计追踪完整性与一致性总审", 15478, 16090),
]


def generate_filename(section_id: str, title: str) -> str:
    """生成文件名：Dxx-小写短横线标题.md"""
    slug = title.replace("、", "-").replace("与", "-").replace("与", "-").replace(" ", "-").replace("，", "")
    slug = slug.replace("详细设计", "")
    slug = slug.replace("模块", "")
    slug = slug.replace("专业", "")
    slug = slug.replace("扩展", "")
    slug = slug.replace("模型", "")
    slug = slug.replace("设计", "")
    slug = slug.replace("与", "-")
    slug = slug.replace("-", "-")
    slug = slug.strip("-")
    if not slug:
        slug = "overview"
    return f"{section_id}-{slug}.md"


def main():
    print("正在读取源文件...")
    with open(SOURCE_FILE, "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    total_lines = len(lines)
    print(f"源文件共 {total_lines} 行")
    
    print("\n正在拆分章节...")
    created_files = []
    
    for section_id, title, start_line, end_line in CHAPTERS:
        filename = generate_filename(section_id, title)
        filepath = os.path.join(DESIGN_DIR, filename)
        
        # 行号从1开始，转换为0-based索引
        content = "".join(lines[start_line - 1:end_line])
        
        # 添加文档头部
        header = f"""# {section_id} {title}

> 来源：@design/INDEX.md | 创建：2026-07-22 | 更新：2026-07-22
> 原始行范围：{start_line}–{end_line}
> 引用约定：同文件内引用使用 §编号，跨文件引用使用 @design/文件名.md

"""
        
        final_content = header + content
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(final_content)
        
        line_count = end_line - start_line + 1
        file_size = len(final_content.encode('utf-8'))
        created_files.append((section_id, filename, line_count, file_size))
        print(f"  ✓ {filename} ({line_count} 行, {file_size:,} 字节)")
    
    print(f"\n拆分完成！共创建 {len(created_files)} 个文件")
    
    # 输出统计
    print("\n=== 章节统计 ===")
    for section_id, filename, line_count, file_size in created_files:
        print(f"{section_id}: {line_count:>4} 行, {file_size/1024:>6.1f} KB")


if __name__ == "__main__":
    main()