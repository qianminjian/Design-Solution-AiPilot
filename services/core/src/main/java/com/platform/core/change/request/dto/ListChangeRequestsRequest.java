package com.platform.core.change.request.dto;

import com.platform.core.change.domain.enums.ChangeStatus;
import com.platform.core.change.domain.enums.ChangeType;
import com.platform.core.change.domain.enums.ChangePriority;

/**
 * 变更请求列表查询参数
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
public record ListChangeRequestsRequest(
        String projectId,
        ChangeStatus status,
        ChangeType type,
        ChangePriority priority,
        String keyword,
        Integer page,
        Integer pageSize
) {
}
