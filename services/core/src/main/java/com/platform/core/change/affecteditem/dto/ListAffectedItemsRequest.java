package com.platform.core.change.affecteditem.dto;

import com.platform.core.change.domain.enums.AffectedObjectType;
import com.platform.core.change.domain.enums.ImpactLevel;
import com.platform.core.change.domain.enums.RecheckStatus;

/**
 * 列出受影响项请求（D37.16 P12）
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
public record ListAffectedItemsRequest(
        AffectedObjectType type,
        ImpactLevel impact,
        RecheckStatus recheckStatus,
        String discipline,
        String keyword,
        Integer page,
        Integer pageSize
) {
}
