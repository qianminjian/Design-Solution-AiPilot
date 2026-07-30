package com.platform.core.change.affecteditem.dto;

import com.platform.core.change.domain.enums.AffectedAction;
import com.platform.core.change.domain.enums.ImpactLevel;
import com.platform.core.change.domain.enums.RecheckStatus;
import jakarta.validation.constraints.Size;

/**
 * 更新受影响项请求（D37.16 P12）
 *
 * <p>用于更新影响判定、复查状态、责任人等。
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
public record UpdateAffectedItemRequest(
        ImpactLevel impact,
        AffectedAction action,
        Boolean recheckRequired,
        RecheckStatus recheckStatus,
        @Size(max = 200)
        String owner,
        @Size(max = 2000)
        String evidence,
        @Size(max = 200)
        String recheckedBy
) {
}
