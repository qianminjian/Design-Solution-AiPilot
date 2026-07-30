package com.platform.core.governance.accessgrant.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.governance.accessgrant.domain.AccessGrant;
import com.platform.core.governance.accessgrant.dto.AccessGrantActionRequest;
import com.platform.core.governance.accessgrant.dto.AccessGrantDto;
import com.platform.core.governance.accessgrant.repository.GovernanceAccessGrantRepository;
import com.platform.core.governance.domain.enums.GovernanceAccessGrantStatus;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * 治理域访问授权服务（D37.17 Access Review）
 *
 * 核心操作：
 *  - listAccessGrants：按租户/状态/风险等级查询
 *  - getAccessGrant：单条详情
 *  - actOnGrant：approve/shorten/revoke 操作
 *
 * 安全：
 *  - approve/shorten/revoke 操作前必须校验 stepUpToken（V1 简化：非空校验）
 *  - shorten 操作必须提供 newExpiresAt 早于原 expiresAt
 *  - hasLegalHold=true 的授权不可 revoke
 */
@Service
public class AccessGrantService {

    private static final Logger log = LoggerFactory.getLogger(AccessGrantService.class);

    private final GovernanceAccessGrantRepository repository;
    private final ObjectMapper objectMapper;

    public AccessGrantService(
            GovernanceAccessGrantRepository repository,
            ObjectMapper objectMapper
    ) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public Page<AccessGrantDto> listAccessGrants(
            UUID tenantId,
            GovernanceAccessGrantStatus status,
            Pageable pageable
    ) {
        Specification<AccessGrant> spec = (root, query, cb) ->
                cb.equal(root.get("tenantId"), tenantId);
        if (status != null) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("status"), status));
        }
        return repository.findAll(spec, pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public AccessGrantDto getAccessGrant(UUID tenantId, UUID id) {
        AccessGrant entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "AccessGrant not found: " + id));
        return toDto(entity);
    }

    /**
     * 执行 approve/shorten/revoke 操作
     *
     * @param httpRequest 用于解析操作者身份（V1 简化：从 header 取 x-user-id）
     */
    @Transactional
    public AccessGrantDto actOnGrant(
            UUID tenantId,
            UUID id,
            AccessGrantActionRequest request,
            HttpServletRequest httpRequest
    ) {
        AccessGrant entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "AccessGrant not found: " + id));

        validateStepUp(entity, request);
        String operator = resolveOperator(httpRequest);

        switch (request.action()) {
            case APPROVE -> entity.setStatus(GovernanceAccessGrantStatus.ACTIVE);
            case SHORTEN -> {
                if (request.newExpiresAt() == null) {
                    throw new BusinessException(
                            ErrorCode.BUSINESS_RULE_VIOLATION,
                            "newExpiresAt is required for shorten action");
                }
                if (request.newExpiresAt().isAfter(entity.getExpiresAt())) {
                    throw new BusinessException(
                            ErrorCode.BUSINESS_RULE_VIOLATION,
                            "newExpiresAt must be earlier than current expiresAt");
                }
                if (request.newExpiresAt().isBefore(Instant.now())) {
                    throw new BusinessException(
                            ErrorCode.BUSINESS_RULE_VIOLATION,
                            "newExpiresAt must be in the future");
                }
                entity.setExpiresAt(request.newExpiresAt());
                entity.setStatus(GovernanceAccessGrantStatus.SHORTENED);
            }
            case REVOKE -> {
                if (entity.isHasLegalHold()) {
                    throw new BusinessException(
                            ErrorCode.BUSINESS_RULE_VIOLATION,
                            "Cannot revoke access grant with legal hold");
                }
                entity.setStatus(GovernanceAccessGrantStatus.REVOKED);
            }
        }
        entity.setUpdatedBy(UUID.fromString(operator));
        AccessGrant saved = repository.save(entity);
        log.info(
                "AccessGrant acted: id={}, action={}, operator={}, tenantId={}",
                id, request.action(), operator, tenantId);
        return toDto(saved);
    }

    private void validateStepUp(AccessGrant entity, AccessGrantActionRequest request) {
        if (entity.isRequiresStepUp()
                && (request.stepUpToken() == null || request.stepUpToken().isBlank())) {
            throw new BusinessException(
                    ErrorCode.FORBIDDEN,
                    HttpStatus.FORBIDDEN,
                    "Step-up authentication required for this action");
        }
    }

    private String resolveOperator(HttpServletRequest httpRequest) {
        String userId = httpRequest.getHeader("x-user-id");
        if (userId == null || userId.isBlank()) {
            throw new BusinessException(
                    ErrorCode.UNAUTHORIZED,
                    HttpStatus.UNAUTHORIZED,
                    "x-user-id header required");
        }
        return userId;
    }

    private AccessGrantDto toDto(AccessGrant entity) {
        List<String> dependents = parseDependents(entity.getPropagationDependents());
        return new AccessGrantDto(
                entity.getId(),
                entity.getType(),
                entity.getPrincipalName(),
                entity.getPrincipalEmail(),
                entity.getResource(),
                entity.getPermission(),
                entity.getRiskLevel(),
                entity.getStatus(),
                entity.getGrantedBy(),
                entity.getGrantedAt(),
                entity.getExpiresAt(),
                entity.getLastUsedAt(),
                entity.getOwner(),
                entity.getOwnerEmail(),
                entity.getReason(),
                entity.isRequiresStepUp(),
                entity.isHasLegalHold(),
                dependents
        );
    }

    private List<String> parseDependents(String json) {
        if (json == null || json.isBlank() || "[]".equals(json)) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse propagationDependents: {}", json, e);
            return Collections.emptyList();
        }
    }
}
