package com.platform.core.tevv.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.tevv.domain.VerificationItem;
import com.platform.core.tevv.domain.VerificationStatus;
import com.platform.core.tevv.dto.CreateVerificationItemRequest;
import com.platform.core.tevv.dto.VerificationItemDto;
import com.platform.core.tevv.repository.VerificationItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 验证项服务 — 管理 Gate 准入验证条目
 */
@Service
public class VerificationItemService {

    private final VerificationItemRepository itemRepository;

    public VerificationItemService(VerificationItemRepository itemRepository) {
        this.itemRepository = itemRepository;
    }

    /** 创建验证项 */
    @Transactional
    public VerificationItemDto create(UUID tenantId, CreateVerificationItemRequest request, UUID userId) {
        validateGateNumber(request.gateNumber());

        VerificationItem entity = new VerificationItem();
        entity.setTenantId(tenantId);
        entity.setDatasetId(request.datasetId());
        entity.setItemCode(request.itemCode());
        entity.setTitle(request.title());
        entity.setDescription(request.description());
        entity.setGateNumber(request.gateNumber());
        entity.setVerificationType(request.verificationType());
        entity.setRiskLevel(request.riskLevel() != null ? request.riskLevel() : "MEDIUM");
        entity.setCreatedBy(userId);
        entity.setUpdatedBy(userId);

        return toDto(itemRepository.save(entity));
    }

    /** 按数据集查询验证项 */
    @Transactional(readOnly = true)
    public List<VerificationItemDto> listByDataset(UUID tenantId, UUID datasetId) {
        return itemRepository.findByTenantIdAndDatasetId(tenantId, datasetId).stream()
                .map(this::toDto)
                .toList();
    }

    /** 更新验证状态 */
    @Transactional
    public VerificationItemDto updateStatus(UUID tenantId, UUID itemId, VerificationStatus newStatus,
                                             UUID userId, String waiverReason) {
        VerificationItem item = itemRepository.findById(itemId)
                .filter(i -> i.getTenantId().equals(tenantId))
                .orElseThrow(() -> new BusinessException(ErrorCode.VERIFICATION_ITEM_NOT_FOUND, "验证项不存在"));

        // 豁免必须提供原因
        if (newStatus == VerificationStatus.WAIVED && (waiverReason == null || waiverReason.isBlank())) {
            throw new BusinessException(ErrorCode.WAIVER_REASON_REQUIRED, "豁免必须提供原因");
        }

        item.setStatus(newStatus);
        item.setVerifiedBy(userId);
        item.setVerifiedAt(Instant.now());
        if (newStatus == VerificationStatus.WAIVED) {
            item.setWaiverReason(waiverReason);
        }
        item.setUpdatedBy(userId);

        return toDto(itemRepository.save(item));
    }

    /** 统计数据集各状态的验证项数量 */
    @Transactional(readOnly = true)
    public long countByStatus(UUID tenantId, UUID datasetId, VerificationStatus status) {
        return itemRepository.countByTenantIdAndDatasetIdAndStatus(tenantId, datasetId, status);
    }

    private void validateGateNumber(Short gateNumber) {
        if (gateNumber == null || gateNumber < 1 || gateNumber > 6) {
            throw new BusinessException(ErrorCode.INVALID_GATE_NUMBER, "Gate 编号必须在 1-6 之间");
        }
    }

    private VerificationItemDto toDto(VerificationItem e) {
        return new VerificationItemDto(
                e.getId(), e.getDatasetId(), e.getItemCode(), e.getTitle(), e.getDescription(),
                e.getGateNumber(), e.getVerificationType(), e.getRiskLevel(), e.getStatus(),
                e.getEvidenceRefs(), e.getVerifiedBy(), e.getVerifiedAt(), e.getWaiverReason()
        );
    }
}
