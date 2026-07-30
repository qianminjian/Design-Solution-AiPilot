package com.platform.core.governance.evidence.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.governance.domain.enums.GovernanceEvidencePackageStatus;
import com.platform.core.governance.evidence.domain.EvidenceItem;
import com.platform.core.governance.evidence.domain.EvidencePackage;
import com.platform.core.governance.evidence.dto.EvidencePackageActionRequest;
import com.platform.core.governance.evidence.dto.EvidencePackageDto;
import com.platform.core.governance.evidence.repository.EvidenceItemRepository;
import com.platform.core.governance.evidence.repository.EvidencePackageRepository;
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
import java.util.List;
import java.util.UUID;

/**
 * 治理域证据包服务（D37.17 Audit/Evidence 证据包）
 */
@Service
public class EvidencePackageService {

    private static final Logger log = LoggerFactory.getLogger(EvidencePackageService.class);

    private final EvidencePackageRepository packageRepository;
    private final EvidenceItemRepository itemRepository;

    public EvidencePackageService(
            EvidencePackageRepository packageRepository,
            EvidenceItemRepository itemRepository
    ) {
        this.packageRepository = packageRepository;
        this.itemRepository = itemRepository;
    }

    @Transactional(readOnly = true)
    public Page<EvidencePackageDto> listEvidencePackages(
            UUID tenantId,
            GovernanceEvidencePackageStatus status,
            Pageable pageable
    ) {
        Specification<EvidencePackage> spec = (root, q, cb) ->
                cb.equal(root.get("tenantId"), tenantId);
        if (status != null) {
            spec = spec.and((root, q, cb) ->
                    cb.equal(root.get("status"), status));
        }
        return packageRepository.findAll(spec, pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public EvidencePackageDto getEvidencePackage(UUID tenantId, UUID id) {
        EvidencePackage entity = packageRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "EvidencePackage not found: " + id));
        return toDto(entity);
    }

    @Transactional
    public EvidencePackageDto actOnEvidencePackage(
            UUID tenantId,
            UUID id,
            EvidencePackageActionRequest request,
            HttpServletRequest httpRequest
    ) {
        EvidencePackage entity = packageRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "EvidencePackage not found: " + id));

        String operator = resolveOperator(httpRequest);

        switch (request.action()) {
            case SEAL -> {
                if (entity.getStatus() != GovernanceEvidencePackageStatus.DRAFT) {
                    throw new BusinessException(
                            ErrorCode.BUSINESS_RULE_VIOLATION,
                            "Only DRAFT status can be sealed");
                }
                if (request.verifier() == null || request.verifier().isBlank()) {
                    throw new BusinessException(
                            ErrorCode.BUSINESS_RULE_VIOLATION,
                            "verifier is required for SEAL action");
                }
                validateStepUp(request);
                entity.setStatus(GovernanceEvidencePackageStatus.SEALED);
                entity.setSealedBy(request.verifier());
                entity.setSealedAt(Instant.now());
            }
            case VERIFY -> {
                if (entity.getStatus() != GovernanceEvidencePackageStatus.SEALED) {
                    throw new BusinessException(
                            ErrorCode.BUSINESS_RULE_VIOLATION,
                            "Only SEALED status can be verified");
                }
                if (request.verifier() == null || request.verifier().isBlank()) {
                    throw new BusinessException(
                            ErrorCode.BUSINESS_RULE_VIOLATION,
                            "verifier is required for VERIFY action");
                }
                if (request.signature() == null || request.signature().isBlank()) {
                    throw new BusinessException(
                            ErrorCode.BUSINESS_RULE_VIOLATION,
                            "signature is required for VERIFY action");
                }
                validateStepUp(request);
                entity.setStatus(GovernanceEvidencePackageStatus.VERIFIED);
                entity.setVerifiedBy(request.verifier());
                entity.setVerifiedAt(Instant.now());
            }
            case EXPORT -> {
                log.info(
                        "EvidencePackage exported: id={}, operator={}, tenantId={}",
                        id, operator, tenantId);
            }
            case CHALLENGE -> {
                if (entity.getStatus() == GovernanceEvidencePackageStatus.DRAFT) {
                    throw new BusinessException(
                            ErrorCode.BUSINESS_RULE_VIOLATION,
                            "Cannot challenge DRAFT evidence");
                }
                entity.setStatus(GovernanceEvidencePackageStatus.CHALLENGED);
            }
        }
        entity.setUpdatedBy(UUID.fromString(operator));
        EvidencePackage saved = packageRepository.save(entity);
        log.info(
                "EvidencePackage acted: id={}, action={}, operator={}, tenantId={}",
                id, request.action(), operator, tenantId);
        return toDto(saved);
    }

    private void validateStepUp(EvidencePackageActionRequest request) {
        if (request.stepUpToken() == null || request.stepUpToken().isBlank()) {
            throw new BusinessException(
                    ErrorCode.FORBIDDEN,
                    HttpStatus.FORBIDDEN,
                    "Step-up authentication required for " + request.action());
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

    private EvidencePackageDto toDto(EvidencePackage entity) {
        List<EvidenceItem> items = itemRepository.findByPackageId(entity.getId());
        List<EvidencePackageDto.EvidenceItemDto> itemDtos = items.stream()
                .map(item -> new EvidencePackageDto.EvidenceItemDto(
                        item.getId(),
                        item.getSource(),
                        item.getRevision(),
                        item.getToolchain(),
                        item.getHash(),
                        item.getCapturedAt()
                ))
                .toList();
        return new EvidencePackageDto(
                entity.getId(),
                entity.getName(),
                entity.getStatus(),
                entity.getObjectId(),
                entity.getObjectType(),
                itemDtos,
                entity.getSealedBy(),
                entity.getSealedAt(),
                entity.getVerifiedBy(),
                entity.getVerifiedAt(),
                entity.getHash(),
                entity.getCreatedAt()
        );
    }
}
