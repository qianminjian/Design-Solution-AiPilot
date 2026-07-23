package com.platform.core.portfolio.support;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * 阶段定义与状态机
 * 权威源：@design/D05-全流程阶段-阶段门.md + @design/D05.18 V0 阶段裁剪
 *
 * <p>提供：
 * <ul>
 *   <li>阶段编码 → 名称/顺序映射</li>
 *   <li>V0 裁剪阶段集（STG-P0/P1/P2/P5/P6/P7）</li>
 *   <li>D05.4.1 阶段状态机校验</li>
 * </ul>
 */
public final class StageDefinitions {

    private StageDefinitions() {
    }

    // ── 阶段编码常量（与 portfolio.contract.ts StageCode 对齐）──
    public static final String STG_P0 = "STG-P0";
    public static final String STG_P1 = "STG-P1";
    public static final String STG_P2 = "STG-P2";
    public static final String STG_P3 = "STG-P3";
    public static final String STG_P4 = "STG-P4";
    public static final String STG_P5 = "STG-P5";
    public static final String STG_P6 = "STG-P6";
    public static final String STG_P7 = "STG-P7";
    public static final String STG_P8 = "STG-P8";

    /**
     * 阶段元数据：编码 → (名称, 顺序)
     * 名称来自 portfolio.contract.ts StageCode 注释
     */
    private static final Map<String, StageMeta> STAGE_META_MAP = Map.of(
            STG_P0, new StageMeta(STG_P0, "前期策划与需求门", 0),
            STG_P1, new StageMeta(STG_P1, "概念设计门", 1),
            STG_P2, new StageMeta(STG_P2, "方案设计门（V0 轻量）", 2),
            STG_P3, new StageMeta(STG_P3, "扩初设计门", 3),
            STG_P4, new StageMeta(STG_P4, "施工图设计门", 4),
            STG_P5, new StageMeta(STG_P5, "综合校审门", 5),
            STG_P6, new StageMeta(STG_P6, "发布与交付门", 6),
            STG_P7, new StageMeta(STG_P7, "反馈与变更门", 7),
            STG_P8, new StageMeta(STG_P8, "项目关闭与归档门", 8)
    );

    /**
     * V0 阶段裁剪集（D05.18）：P0/P1/P2/P5/P6/P7
     */
    public static final List<String> V0_STAGE_CODES = List.of(
            STG_P0, STG_P1, STG_P2, STG_P5, STG_P6, STG_P7);

    // ── 阶段状态常量（D05.4.1）──
    public static final String STATUS_NOT_STARTED = "NOT_STARTED";
    public static final String STATUS_PLANNED = "PLANNED";
    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_REVIEW_PREPARING = "REVIEW_PREPARING";
    public static final String STATUS_UNDER_REVIEW = "UNDER_REVIEW";
    public static final String STATUS_CONDITIONALLY_APPROVED = "CONDITIONALLY_APPROVED";
    public static final String STATUS_APPROVED = "APPROVED";
    public static final String STATUS_SUSPENDED = "SUSPENDED";
    public static final String STATUS_CANCELLED = "CANCELLED";
    public static final String STATUS_CLOSED = "CLOSED";

    /**
     * 状态机：每个状态允许流转到的目标状态集合
     * 终态（CLOSED / CANCELLED）不允许流转
     */
    private static final Map<String, Set<String>> TRANSITION_MAP = Map.of(
            STATUS_NOT_STARTED, Set.of(STATUS_PLANNED, STATUS_ACTIVE, STATUS_CANCELLED),
            STATUS_PLANNED, Set.of(STATUS_ACTIVE, STATUS_SUSPENDED, STATUS_CANCELLED),
            STATUS_ACTIVE, Set.of(STATUS_REVIEW_PREPARING, STATUS_SUSPENDED, STATUS_CANCELLED),
            STATUS_REVIEW_PREPARING, Set.of(STATUS_UNDER_REVIEW, STATUS_ACTIVE, STATUS_CANCELLED),
            STATUS_UNDER_REVIEW, Set.of(
                    STATUS_CONDITIONALLY_APPROVED, STATUS_APPROVED,
                    STATUS_ACTIVE, STATUS_CANCELLED),
            STATUS_CONDITIONALLY_APPROVED, Set.of(STATUS_APPROVED, STATUS_CANCELLED),
            STATUS_APPROVED, Set.of(STATUS_CLOSED, STATUS_SUSPENDED),
            STATUS_SUSPENDED, Set.of(STATUS_ACTIVE, STATUS_CANCELLED),
            STATUS_CLOSED, Set.of(),
            STATUS_CANCELLED, Set.of()
    );

    /**
     * 获取阶段元数据（名称 + 顺序）
     *
     * @param stageCode 阶段编码
     * @return 阶段元数据 Optional
     */
    public static Optional<StageMeta> getStageMeta(String stageCode) {
        return Optional.ofNullable(STAGE_META_MAP.get(stageCode));
    }

    /**
     * 校验阶段编码合法性
     *
     * @param stageCode 阶段编码
     * @throws BusinessException 编码非法
     */
    public static void requireValidCode(String stageCode) {
        if (!STAGE_META_MAP.containsKey(stageCode)) {
            throw new BusinessException(
                    ErrorCode.INVALID_STAGE_CODE,
                    "非法阶段编码: " + stageCode);
        }
    }

    /**
     * 校验状态流转合法性（D05.4.1 状态机）
     *
     * @param from 当前状态
     * @param to   目标状态
     * @return true 允许流转
     */
    public static boolean isValidTransition(String from, String to) {
        Set<String> allowed = TRANSITION_MAP.get(from);
        return allowed != null && allowed.contains(to);
    }

    /**
     * 校验状态流转，非法时抛业务异常
     *
     * @param from 当前状态
     * @param to   目标状态
     * @throws BusinessException 非法流转
     */
    public static void requireValidTransition(String from, String to) {
        if (!isValidTransition(from, to)) {
            throw new BusinessException(
                    ErrorCode.INVALID_STAGE_TRANSITION,
                    "非法阶段状态流转: " + from + " → " + to);
        }
    }

    /**
     * 判断目标状态是否为终态
     */
    public static boolean isTerminal(String status) {
        return STATUS_CLOSED.equals(status) || STATUS_CANCELLED.equals(status);
    }

    /**
     * 阶段元数据值对象
     *
     * @param code  阶段编码
     * @param name  阶段名称
     * @param order 阶段顺序
     */
    public record StageMeta(String code, String name, int order) {
    }
}
