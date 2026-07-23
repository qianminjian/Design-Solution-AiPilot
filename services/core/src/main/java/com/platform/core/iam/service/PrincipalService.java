package com.platform.core.iam.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.iam.domain.Principal;
import com.platform.core.iam.dto.CreatePrincipalRequest;
import com.platform.core.iam.dto.PrincipalDto;
import com.platform.core.iam.dto.UpdatePrincipalRequest;
import com.platform.core.iam.repository.PrincipalRepository;
import com.platform.core.iam.repository.TenantRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

/**
 * 主体应用服务
 * 涵盖主体 CRUD 与密码加密、唯一性校验等业务规则
 */
@Service
public class PrincipalService {

    private static final Logger log = LoggerFactory.getLogger(PrincipalService.class);

    private final PrincipalRepository principalRepository;
    private final TenantRepository tenantRepository;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;

    public PrincipalService(PrincipalRepository principalRepository,
                            TenantRepository tenantRepository,
                            PasswordEncoder passwordEncoder,
                            ObjectMapper objectMapper) {
        this.principalRepository = principalRepository;
        this.tenantRepository = tenantRepository;
        this.passwordEncoder = passwordEncoder;
        this.objectMapper = objectMapper;
    }

    /**
     * 创建主体
     * 业务规则：
     * 1. 租户必须存在
     * 2. 同租户下邮箱唯一（未软删）
     * 3. 密码使用 BCrypt 加密
     */
    @Transactional
    public PrincipalDto createPrincipal(UUID tenantId, CreatePrincipalRequest request) {
        validateTenantExists(tenantId);
        validateEmailUnique(tenantId, request.email());

        Principal principal = new Principal();
        principal.setTenantId(tenantId);
        principal.setType(request.type() != null ? request.type() : "USER");
        principal.setEmail(request.email());
        principal.setDisplayName(request.displayName());
        principal.setPasswordHash(passwordEncoder.encode(request.password()));
        principal.setStatus("ACTIVE");
        principal.setLocale(request.locale() != null ? request.locale() : "en");
        principal.setTimezone(request.timezone() != null ? request.timezone() : "UTC");
        principal.setExternalId(request.externalId());
        principal.setMetadata(serializeMetadata(request.metadata()));

        Principal saved = principalRepository.save(principal);
        log.info("创建主体成功 tenantId={} principalId={}", tenantId, saved.getId());
        return toDto(saved);
    }

    /**
     * 按 ID 查询主体
     */
    @Transactional(readOnly = true)
    public PrincipalDto getPrincipal(UUID tenantId, UUID principalId) {
        Principal principal = loadPrincipalOrThrow(tenantId, principalId);
        return toDto(principal);
    }

    /**
     * 分页查询主体
     */
    @Transactional(readOnly = true)
    public Page<PrincipalDto> listPrincipals(UUID tenantId, Pageable pageable) {
        return principalRepository.findByTenantId(tenantId, pageable)
                .map(this::toDto);
    }

    /**
     * 部分更新主体
     * 不允许通过本接口修改密码（须走专门接口）
     */
    @Transactional
    public PrincipalDto updatePrincipal(UUID tenantId, UUID principalId, UpdatePrincipalRequest request) {
        Principal principal = loadPrincipalOrThrow(tenantId, principalId);
        applyUpdate(principal, request);
        Principal saved = principalRepository.save(principal);
        log.info("更新主体成功 tenantId={} principalId={}", tenantId, principalId);
        return toDto(saved);
    }

    /**
     * 应用更新字段（仅非 null 字段被更新）
     */
    private void applyUpdate(Principal principal, UpdatePrincipalRequest request) {
        if (request.displayName() != null) {
            principal.setDisplayName(request.displayName());
        }
        if (request.status() != null) {
            principal.setStatus(request.status());
        }
        if (request.locale() != null) {
            principal.setLocale(request.locale());
        }
        if (request.timezone() != null) {
            principal.setTimezone(request.timezone());
        }
        if (request.metadata() != null) {
            principal.setMetadata(serializeMetadata(request.metadata()));
        }
    }

    /**
     * 校验租户存在
     */
    private void validateTenantExists(UUID tenantId) {
        if (!tenantRepository.existsById(tenantId)) {
            throw new BusinessException(ErrorCode.TENANT_NOT_FOUND, "租户不存在: " + tenantId);
        }
    }

    /**
     * 校验邮箱唯一
     */
    private void validateEmailUnique(UUID tenantId, String email) {
        if (principalRepository.existsByTenantIdAndEmailAndDeletedAtIsNull(tenantId, email)) {
            throw new BusinessException(ErrorCode.PRINCIPAL_ALREADY_EXISTS,
                    "主体已存在: " + email);
        }
    }

    /**
     * 加载主体（带租户校验，防越权）
     */
    private Principal loadPrincipalOrThrow(UUID tenantId, UUID principalId) {
        return principalRepository.findById(principalId)
                .filter(p -> tenantId.equals(p.getTenantId()))
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.PRINCIPAL_NOT_FOUND,
                        "主体不存在: " + principalId));
    }

    /**
     * Map → JSON 字符串（失败抛业务异常，不吞异常）
     */
    private String serializeMetadata(Map<String, Object> metadata) {
        if (metadata == null || metadata.isEmpty()) {
            return "{}";
        }
        try {
            return objectMapper.writeValueAsString(metadata);
        } catch (JsonProcessingException ex) {
            log.error("metadata 序列化失败", ex);
            throw new BusinessException(ErrorCode.PARAM_INVALID, "metadata JSON 序列化失败");
        }
    }

    /**
     * 实体 → DTO（绝不暴露 passwordHash）
     */
    private PrincipalDto toDto(Principal p) {
        return new PrincipalDto(
                p.getId(),
                p.getTenantId(),
                p.getType(),
                p.getEmail(),
                p.getDisplayName(),
                p.getStatus(),
                p.getLocale(),
                p.getTimezone(),
                p.getClassification() != null ? p.getClassification().name() : null,
                p.getExternalId(),
                p.getLastLoginAt(),
                p.getCreatedAt(),
                p.getUpdatedAt(),
                p.getRowVersion()
        );
    }
}
