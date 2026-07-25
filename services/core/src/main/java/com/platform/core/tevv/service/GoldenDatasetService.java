package com.platform.core.tevv.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.tevv.domain.DatasetStatus;
import com.platform.core.tevv.domain.GoldenDataset;
import com.platform.core.tevv.dto.CreateDatasetRequest;
import com.platform.core.tevv.dto.GoldenDatasetDto;
import com.platform.core.tevv.repository.GoldenDatasetRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 金样数据集服务 — 管理 TEVV 验证数据集的生命周期
 */
@Service
public class GoldenDatasetService {

    private final GoldenDatasetRepository datasetRepository;

    public GoldenDatasetService(GoldenDatasetRepository datasetRepository) {
        this.datasetRepository = datasetRepository;
    }

    /** 创建数据集 */
    @Transactional
    public GoldenDatasetDto create(UUID tenantId, CreateDatasetRequest request, UUID userId) {
        // 校验名称+版本唯一
        if (datasetRepository.existsByTenantIdAndNameAndVersion(tenantId, request.name(), "1.0.0")) {
            throw new BusinessException(ErrorCode.DATASET_NAME_VERSION_EXISTS, "数据集名称已存在: " + request.name());
        }

        GoldenDataset entity = new GoldenDataset();
        entity.setTenantId(tenantId);
        entity.setName(request.name());
        entity.setDescription(request.description());
        entity.setCategory(request.category());
        entity.setBuildingType(request.buildingType());
        entity.setStorageKey(request.storageKey());
        entity.setStatus(DatasetStatus.DRAFT);
        entity.setCreatedBy(userId);
        entity.setUpdatedBy(userId);

        GoldenDataset saved = datasetRepository.save(entity);
        return toDto(saved);
    }

    /** 查询数据集列表（含 DRAFT/FROZEN/DEPRECATED 所有状态） */
    @Transactional(readOnly = true)
    public List<GoldenDatasetDto> listByTenant(UUID tenantId) {
        return datasetRepository.findByTenantId(tenantId).stream()
                .map(this::toDto)
                .toList();
    }

    /** 冻结数据集 */
    @Transactional
    public GoldenDatasetDto freeze(UUID tenantId, UUID datasetId, UUID userId) {
        GoldenDataset ds = datasetRepository.findById(datasetId)
                .filter(d -> d.getTenantId().equals(tenantId))
                .orElseThrow(() -> new BusinessException(ErrorCode.DATASET_NOT_FOUND, "数据集不存在"));

        if (ds.getStatus() != DatasetStatus.DRAFT) {
            throw new BusinessException(ErrorCode.INVALID_DATASET_STATUS, "仅 DRAFT 状态可冻结");
        }

        ds.setStatus(DatasetStatus.FROZEN);
        ds.setFrozenAt(Instant.now());
        ds.setFrozenBy(userId);
        ds.setUpdatedBy(userId);

        return toDto(datasetRepository.save(ds));
    }

    private GoldenDatasetDto toDto(GoldenDataset e) {
        return new GoldenDatasetDto(
                e.getId(), e.getName(), e.getDescription(), e.getCategory(),
                e.getBuildingType(), e.getStatus(), e.getVersion(), e.getStorageKey(),
                e.getFileCount(), e.getTotalSizeBytes(), e.getFrozenAt(), e.getFrozenBy(),
                e.getCreatedAt(), e.getCreatedBy()
        );
    }
}
