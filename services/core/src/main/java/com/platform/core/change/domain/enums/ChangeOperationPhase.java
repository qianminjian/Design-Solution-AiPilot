package com.platform.core.change.domain.enums;

/**
 * 变更操作阶段
 *
 * 与前端 ChangeOperationPhase 契约对齐（@design/D37-关键界面-交互状态.md §D37.16）。
 * 记录变更请求的关键阶段时间线。
 */
public enum ChangeOperationPhase {
    /** 创建草稿 */
    CREATE_DRAFT,
    /** 提交变更 */
    SUBMIT,
    /** 影响评估 */
    IMPACT_ASSESSMENT,
    /** 提交影响评估结果 */
    SUBMIT_IMPACT,
    /** 批准变更 */
    APPROVE,
    /** 拒绝变更 */
    REJECT,
    /** 撤回变更 */
    RECALL,
    /** 启动实施 */
    START_IMPLEMENTATION,
    /** 生成处置任务 */
    GENERATE_TASK_PLAN,
    /** 提交关闭验证 */
    SUBMIT_VERIFICATION,
    /** 验证关闭 */
    VERIFY_CLOSURE,
    /** 关闭完成（终态） */
    CLOSED
}
