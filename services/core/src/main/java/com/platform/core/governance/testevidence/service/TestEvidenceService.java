package com.platform.core.governance.testevidence.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.governance.testevidence.domain.TestEvidence;
import com.platform.core.governance.testevidence.domain.TestEvidenceRetention;
import com.platform.core.governance.testevidence.domain.TestEvidenceType;
import com.platform.core.governance.testevidence.dto.TestEvidenceCreateRequest;
import com.platform.core.governance.testevidence.dto.TestEvidenceDto;
import com.platform.core.governance.testevidence.dto.TestEvidenceVerifyRequest;
import com.platform.core.governance.testevidence.dto.TestEvidenceVerifyResult;
import com.platform.core.governance.testevidence.repository.TestEvidenceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * 测试证据服务（D45.10 TestEvidence，P0-1.4）
 *
 * 证据链语义：只追加（Write Once Read Many），不支持修改/删除。
 * 验收：证据 hash 可校验，签名可验证（V0 存储签名，验证逻辑随签名服务接入）。
 */
@Service
public class TestEvidenceService {

    private static final Logger log = LoggerFactory.getLogger(TestEvidenceService.class);

    /** 数据分级白名单（对齐 security.md §8 PII 分级 L1-L5） */
    private static final Set<String> VALID_CLASSIFICATIONS = Set.of("L1", "L2", "L3", "L4", "L5");

    private final TestEvidenceRepository repository;

    public TestEvidenceService(TestEvidenceRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public TestEvidenceDto create(UUID tenantId, TestEvidenceCreateRequest request) {
        TestEvidenceType type = parseEnum(
                TestEvidenceType.class, request.evidenceType(), "evidenceType");
        TestEvidenceRetention retention = parseEnum(
                TestEvidenceRetention.class, request.retention(), "retention");
        validateClassification(request.classification());

        TestEvidence entity = new TestEvidence();
        entity.setTenantId(tenantId);
        entity.setEvidenceType(type);
        entity.setObjectUri(request.objectUri());
        entity.setHash(request.hash());
        entity.setTool(request.tool());
        entity.setVersion(request.version());
        entity.setRawSummary(request.rawSummary());
        entity.setRetention(retention);
        entity.setClassification(request.classification());
        entity.setSignatureAlgorithm(request.signatureAlgorithm());
        entity.setSignatureValue(request.signatureValue());
        entity.setObjectId(request.objectId());
        entity.setObjectType(request.objectType());
        entity.setTestRunId(request.testRunId());

        TestEvidence saved = repository.save(entity);
        log.info(
                "TestEvidence created: id={}, type={}, tenantId={}, testRunId={}",
                saved.getId(), type, tenantId, request.testRunId());
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public TestEvidenceDto get(UUID tenantId, UUID id) {
        TestEvidence entity = findByIdAndTenant(tenantId, id);
        return toDto(entity);
    }

    @Transactional(readOnly = true)
    public Page<TestEvidenceDto> list(
            UUID tenantId,
            TestEvidenceType type,
            String testRunId,
            Pageable pageable
    ) {
        Specification<TestEvidence> spec = (root, q, cb) ->
                cb.equal(root.get("tenantId"), tenantId);
        if (type != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("evidenceType"), type));
        }
        if (testRunId != null && !testRunId.isBlank()) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("testRunId"), testRunId));
        }
        return repository.findAll(spec, pageable).map(this::toDto);
    }

    /**
     * 证据 hash 校验（D45.10 验收：证据 hash 可校验）
     *
     * 比对调用方重新计算的内容哈希与存储哈希。
     */
    @Transactional(readOnly = true)
    public TestEvidenceVerifyResult verify(UUID tenantId, TestEvidenceVerifyRequest request) {
        TestEvidence entity = findByIdAndTenant(tenantId, request.evidenceId());
        boolean verified = entity.getHash().equalsIgnoreCase(request.actualHash());
        log.info(
                "TestEvidence verified: id={}, verified={}, tenantId={}",
                entity.getId(), verified, tenantId);
        return new TestEvidenceVerifyResult(
                entity.getId(), verified, entity.getHash(), request.actualHash());
    }

    /** 按对象关联查询（如 releaseId），供 P0-13.x 质量门禁引用 */
    @Transactional(readOnly = true)
    public List<TestEvidenceDto> findByObject(UUID tenantId, String objectId, String objectType) {
        return repository.findByObjectIdAndObjectType(objectId, objectType).stream()
                .filter(e -> e.getTenantId().equals(tenantId))
                .map(this::toDto)
                .toList();
    }

    private TestEvidence findByIdAndTenant(UUID tenantId, UUID id) {
        return repository.findById(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "TestEvidence not found: " + id));
    }

    private void validateClassification(String classification) {
        if (!VALID_CLASSIFICATIONS.contains(classification)) {
            throw new BusinessException(
                    ErrorCode.PARAM_INVALID,
                    "classification must be one of: L1, L2, L3, L4, L5");
        }
    }

    private <E extends Enum<E>> E parseEnum(Class<E> enumClass, String value, String fieldName) {
        try {
            return Enum.valueOf(enumClass, value.toUpperCase());
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw new BusinessException(
                    ErrorCode.PARAM_INVALID,
                    "invalid " + fieldName + ": " + value);
        }
    }

    private TestEvidenceDto toDto(TestEvidence e) {
        return new TestEvidenceDto(
                e.getId(),
                e.getEvidenceType(),
                e.getObjectUri(),
                e.getHash(),
                e.getTool(),
                e.getVersion(),
                e.getRawSummary(),
                e.getRetention(),
                e.getClassification(),
                e.getSignatureAlgorithm(),
                e.getSignatureValue(),
                e.getObjectId(),
                e.getObjectType(),
                e.getTestRunId(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }
}
