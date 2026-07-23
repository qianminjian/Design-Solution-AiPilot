package com.platform.core.compliance.dto;

import java.util.UUID;

public record FindingCommandRequest(
        String command,
        UUID assignedTo,
        String note
) {
}