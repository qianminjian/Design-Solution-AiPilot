package com.platform.core.governance.dataasset.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.auth.jwt.JwtTokenProvider;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.governance.dataasset.domain.DataAsset;
import com.platform.core.governance.dataasset.domain.RetentionPolicy;
import com.platform.core.governance.dataasset.dto.DataAssetActionRequest;
import com.platform.core.governance.dataasset.dto.DataAssetDto;
import com.platform.core.governance.dataasset.repository.DataAssetRepository;
import com.platform.core.governance.domain.enums.GovernanceDataAssetStatus;
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
 * 治理域数据资产服务（D37.17 Data Governance）
 *
 * 操作：
 *  - HOLD：legalHold=true，status=HOLD_CONFLICT
 *  - RELEASE_HOLD：legalHold=false，恢复原 status
 *  - ARCHIVE：status=ARCHIVED
 *  - DELETE：物理删除（需 stepUpToken）
 *  - REPAIR：重置 qualityIssues=0，qualityScore=1.0
 */
@Service
public class DataAssetService {

    private static final Logger log = LoggerFactory.getLogger(DataAssetService.class);

    private final DataAssetRepository repository;
    private final ObjectMapper objectMapper;
    private final JwtTokenProvider jwtTokenProvider;

    public DataAssetService(
            DataAssetRepository repository,
            ObjectMapper objectMapper,
            JwtTokenProvider jwtTokenProvider
    ) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Transactional(readOnly = true)
    public Page<DataAssetDto> listDataAssets(
            UUID tenantId,
            GovernanceDataAssetStatus status,
            Pageable pageable
    ) {
        Specification<DataAsset> spec = (root, query, cb) ->
                cb.equal(root.get("tenantId"), tenantId);
        if (status != null) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("status"), status));
        }
        return repository.findAll(spec, pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public DataAssetDto getDataAsset(UUID tenantId, UUID id) {
        DataAsset entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "DataAsset not found: " + id));
        return toDto(entity);
    }

    @Transactional
    public DataAssetDto actOnDataAsset(
            UUID tenantId,
            UUID id,
            DataAssetActionRequest request,
            HttpServletRequest httpRequest
    ) {
        DataAsset entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "DataAsset not found: " + id));

        String operator = resolveOperator(httpRequest);

        switch (request.action()) {
            case HOLD -> {
                RetentionPolicy r = entity.getRetention();
                entity.setRetention(new RetentionPolicy(
                        r.getYears(), true, r.getDisposalDate()));
                entity.setStatus(GovernanceDataAssetStatus.HOLD_CONFLICT);
            }
            case RELEASE_HOLD -> {
                RetentionPolicy r = entity.getRetention();
                entity.setRetention(new RetentionPolicy(
                        r.getYears(), false, r.getDisposalDate()));
                if (entity.getStatus() == GovernanceDataAssetStatus.HOLD_CONFLICT) {
                    entity.setStatus(GovernanceDataAssetStatus.ACTIVE);
                }
            }
            case ARCHIVE -> entity.setStatus(GovernanceDataAssetStatus.ARCHIVED);
            case DELETE -> {
                validateStepUp(request);
                repository.delete(entity);
                log.info(
                        "DataAsset deleted: id={}, operator={}, tenantId={}",
                        id, operator, tenantId);
                return null;
            }
            case REPAIR -> {
                entity.setQualityIssues(0);
                entity.setQualityScore(1.0);
            }
        }
        entity.setLastModified(Instant.now());
        entity.setUpdatedBy(UUID.fromString(operator));
        DataAsset saved = repository.save(entity);
        log.info(
                "DataAsset acted: id={}, action={}, operator={}, tenantId={}",
                id, request.action(), operator, tenantId);
        return toDto(saved);
    }

    /**
     * 校验 stepUpToken（V1.7 升级：真实 JWT 校验，对齐 Operations 域）
     *
     * @design D40-信息-物理安全.md §Step-up 认证
     */
    private void validateStepUp(DataAssetActionRequest request) {
        if (request.stepUpToken() == null || request.stepUpToken().isBlank()) {
            throw new BusinessException(
                    ErrorCode.FORBIDDEN,
                    HttpStatus.FORBIDDEN,
                    "Step-up authentication required for DELETE action");
        }
        jwtTokenProvider.validateStepUpToken(request.stepUpToken());
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

    private DataAssetDto toDto(DataAsset entity) {
        RetentionPolicy r = entity.getRetention();
        DataAssetDto.RetentionPolicy retentionDto = new DataAssetDto.RetentionPolicy(
                r.getYears(), r.isLegalHold(), r.getDisposalDate());
        return new DataAssetDto(
                entity.getId(),
                entity.getType(),
                entity.getName(),
                entity.getDomain(),
                entity.getOwner(),
                entity.getOwnerEmail(),
                entity.getClassification(),
                retentionDto,
                entity.getQualityScore(),
                entity.getQualityIssues(),
                entity.getLineageCoverage(),
                parseStorageLocations(entity.getStorageLocations()),
                entity.getStatus(),
                entity.getLastModified(),
                entity.getDescription()
        );
    }

    private List<String> parseStorageLocations(String json) {
        if (json == null || json.isBlank() || "[]".equals(json)) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse storageLocations: {}", json, e);
            return Collections.emptyList();
        }
    }
}
