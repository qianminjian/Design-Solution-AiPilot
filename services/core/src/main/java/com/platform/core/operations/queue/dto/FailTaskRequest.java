package com.platform.core.operations.queue.dto;

import jakarta.validation.constraints.Size;

/**
 * 任务失败上报请求 DTO
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
public record FailTaskRequest(
        /** 错误信息（最多 2000 字符，超出自动截断） */
        @Size(max = 2000)
        String errorMessage
) {
}
