package com.platform.core.iam.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.iam.domain.Organization;
import com.platform.core.iam.dto.CreateOrganizationRequest;
import com.platform.core.iam.dto.OrganizationDto;
import com.platform.core.iam.repository.OrganizationRepository;
import com.platform.core.iam.repository.TenantRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

/**
 * 组织应用服务
 */
@Service
public class OrganizationService {

    private static final Logger log = LoggerFactory.getLogger(OrganizationService.class);

    private final OrganizationRepository organizationRepository;
    private final TenantRepository tenantRepository;
    private final ObjectMapper objectMapper;

    public OrganizationService(OrganizationRepository organizationRepository,
                               TenantRepository tenantRepository,
                               ObjectMapper objectMapper) {
        this.organizationRepository = organizationRepository;
        this.tenantRepository = tenantRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * 创建组织
     * 业务规则：
     * 1. 租户必须存在
     * 2. 如果指定 parentId，父组织必须存在且同租户
     */
    @Transactional
    public OrganizationDto createOrganization(UUID tenantId, CreateOrganizationRequest request) {
        validateTenantExists(tenantId);
        validateParentOrganization(tenantId, request.parentId());

        Organization org = new Organization();
        org.setTenantId(tenantId);
        org.setName(request.name());
        org.setType(request.type() != null ? request.type() : "COMPANY");
        org.setParentId(request.parentId());
        org.setStatus("ACTIVE");
        org.setMetadata(serializeMetadata(request.metadata()));

        Organization saved = organizationRepository.save(org);
        log.info("创建组织成功 tenantId={} orgId={}", tenantId, saved.getId());
        return toDto(saved);
    }

    /**
     * 按 ID 查询组织
     */
    @Transactional(readOnly = true)
    public OrganizationDto getOrganization(UUID tenantId, UUID organizationId) {
        Organization org = loadOrganizationOrThrow(tenantId, organizationId);
        return toDto(org);
    }

    /**
     * 分页查询组织（按父 ID；parentId 为 null 时查询顶层）
     */
    @Transactional(readOnly = true)
    public Page<OrganizationDto> listOrganizations(UUID tenantId, UUID parentId, Pageable pageable) {
        Page<Organization> page = parentId == null
                ? organizationRepository.findByTenantIdAndParentIdIsNull(tenantId, pageable)
                : organizationRepository.findByTenantIdAndParentId(tenantId, parentId, pageable);
        return page.map(this::toDto);
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
     * 校验父组织存在且同租户
     */
    private void validateParentOrganization(UUID tenantId, UUID parentId) {
        if (parentId == null) {
            return;
        }
        organizationRepository.findById(parentId)
                .filter(o -> tenantId.equals(o.getTenantId()))
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.ORGANIZATION_NOT_FOUND,
                        "父组织不存在: " + parentId));
    }

    /**
     * 加载组织（带租户校验，防越权）
     */
    private Organization loadOrganizationOrThrow(UUID tenantId, UUID organizationId) {
        return organizationRepository.findById(organizationId)
                .filter(o -> tenantId.equals(o.getTenantId()))
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.ORGANIZATION_NOT_FOUND,
                        "组织不存在: " + organizationId));
    }

    /**
     * Map → JSON 字符串
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
     * 实体 → DTO
     */
    private OrganizationDto toDto(Organization o) {
        return new OrganizationDto(
                o.getId(),
                o.getTenantId(),
                o.getParentId(),
                o.getName(),
                o.getType(),
                o.getStatus(),
                o.getClassification() != null ? o.getClassification().name() : null,
                o.getMetadata(),
                o.getCreatedAt(),
                o.getUpdatedAt(),
                o.getRowVersion()
        );
    }
}
