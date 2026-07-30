package com.platform.core.common.response;

/**
 * 业务错误码常量
 * 错误码段定义见 api-conventions.md §4：
 * 100-199 参数错误、401 未登录、403 无权限、404 不存在、422 业务规则失败、429 限流、500-599 服务端错误
 */
public final class ErrorCode {

    private ErrorCode() {
    }

    // ── 参数错误段（100-199）──
    /** 参数缺失 */
    public static final int PARAM_MISSING = 101;
    /** 参数格式错误 */
    public static final int PARAM_INVALID = 102;
    /** 参数超出范围 */
    public static final int PARAM_OUT_OF_RANGE = 103;

    // ── 认证失败段（401）──
    /** 未登录或 token 失效 */
    public static final int UNAUTHORIZED = 401;
    /** 邮箱或密码错误（防枚举，统一文案） */
    public static final int BAD_CREDENTIALS = 4011;
    /** access token 无效 */
    public static final int TOKEN_INVALID = 4012;
    /** access token 已过期 */
    public static final int TOKEN_EXPIRED = 4013;
    /** refresh token 无效或已撤销 */
    public static final int REFRESH_TOKEN_INVALID = 4014;
    /** step-up token 无效或已过期（危险动作二次认证失败） */
    public static final int STEP_UP_TOKEN_INVALID = 4015;

    // ── 权限不足段（403）──
    /** 已登录但无权限 */
    public static final int FORBIDDEN = 403;

    // ── 资源不存在段（404）──
    /** 资源未找到 */
    public static final int NOT_FOUND = 404;

    // ── 业务规则失败段（422）──
    /**
     * 通用业务规则违反
     * 用于 AI 安全红线等场景下，操作前置条件不满足时的拒绝（如无需复核、已复核、缺少签章）
     */
    public static final int BUSINESS_RULE_VIOLATION = 4220;
    /** 主体已存在（邮箱重复等） */
    public static final int PRINCIPAL_ALREADY_EXISTS = 4221;
    /** 租户不存在 */
    public static final int TENANT_NOT_FOUND = 4222;
    /** 组织不存在 */
    public static final int ORGANIZATION_NOT_FOUND = 4223;
    /** 主体不存在 */
    public static final int PRINCIPAL_NOT_FOUND = 4224;
    /** 主体已被软删除 */
    public static final int PRINCIPAL_ALREADY_DELETED = 4225;
    /** 成员关系已存在 */
    public static final int MEMBERSHIP_ALREADY_EXISTS = 4226;
    /** 新密码不符合复杂度要求 */
    public static final int PASSWORD_POLICY_VIOLATION = 4235;
    /** 项目不存在 */
    public static final int PROJECT_NOT_FOUND = 4227;
    /** 项目编码在租户内已存在 */
    public static final int PROJECT_CODE_ALREADY_EXISTS = 4228;
    /** 阶段实例不存在 */
    public static final int STAGE_NOT_FOUND = 4229;
    /** 非法阶段状态流转 */
    public static final int INVALID_STAGE_TRANSITION = 4230;
    /** 门禁决策不存在 */
    public static final int GATE_NOT_FOUND = 4231;
    /** 项目基线不存在 */
    public static final int BASELINE_NOT_FOUND = 4232;
    /** 基线未冻结（不可被门禁引用） */
    public static final int BASELINE_NOT_FROZEN = 4233;
    /** 阶段编码非法（不在 StageDefinitions 中） */
    public static final int INVALID_STAGE_CODE = 4234;

    // ── CDE 域错误码段（4236-4240）──
    /** 文档不存在 */
    public static final int DOCUMENT_NOT_FOUND = 4236;
    /** 文档版本不存在 */
    public static final int VERSION_NOT_FOUND = 4237;
    /** 文档已被检出，无法重复检出 */
    public static final int DOCUMENT_CHECKED_OUT = 4238;
    /** 文档未被检出，无法检入 */
    public static final int DOCUMENT_NOT_CHECKED_OUT = 4239;
    /** 文档状态非法（不可执行当前操作） */
    public static final int INVALID_DOCUMENT_STATUS = 4240;

    // ── 合规规则域错误码段（4241-4250）──
    /** 规则不存在 */
    public static final int RULE_NOT_FOUND = 4241;
    /** 规则编码已存在 */
    public static final int RULE_CODE_ALREADY_EXISTS = 4242;
    /** 规则版本不存在 */
    public static final int REVISION_NOT_FOUND = 4243;
    /** 规则集不存在 */
    public static final int RULE_SET_NOT_FOUND = 4244;
    /** 规则集名称已存在 */
    public static final int RULE_SET_NAME_ALREADY_EXISTS = 4245;
    /** 检查运行不存在 */
    public static final int CHECK_RUN_NOT_FOUND = 4246;
    /** 合规发现不存在 */
    public static final int FINDING_NOT_FOUND = 4247;
    /** 规则未批准，无法激活 */
    public static final int RULE_NOT_APPROVED = 4248;
    /** 检查运行状态不允许此操作 */
    public static final int INVALID_RUN_STATUS = 4249;

    // ── TEVV 域错误码段（4251-4260）──
    /** 数据集不存在 */
    public static final int DATASET_NOT_FOUND = 4251;
    /** 数据集名称+版本重复 */
    public static final int DATASET_NAME_VERSION_EXISTS = 4252;
    /** 数据集状态非法（不可执行当前操作） */
    public static final int INVALID_DATASET_STATUS = 4253;
    /** 验证项不存在 */
    public static final int VERIFICATION_ITEM_NOT_FOUND = 4254;
    /** 验证项编号重复 */
    public static final int VERIFICATION_ITEM_CODE_EXISTS = 4255;
    /** Gate 编号非法 */
    public static final int INVALID_GATE_NUMBER = 4256;
    /** 豁免缺少原因 */
    public static final int WAIVER_REASON_REQUIRED = 4257;

    // ── 平台事件/Saga 域错误码段（4258-4270）──
    /** Saga 实例不存在 */
    public static final int SAGA_NOT_FOUND = 4258;
    /** Saga 当前状态不允许此操作 */
    public static final int INVALID_SAGA_STATUS = 4259;
    /** Saga 步骤不存在或非法 */
    public static final int INVALID_SAGA_STEP = 4260;
    /** Saga 已完成不可再次执行 */
    public static final int SAGA_ALREADY_COMPLETED = 4261;
    /** Saga 补偿失败 */
    public static final int SAGA_COMPENSATION_FAILED = 4262;
    /** Outbox 事件不存在 */
    public static final int OUTBOX_EVENT_NOT_FOUND = 4263;

    // ── 服务端错误段（500-599）──
    /** 内部异常 */
    public static final int INTERNAL_ERROR = 500;
}
