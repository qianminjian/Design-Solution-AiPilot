package com.platform.core.design.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.design.domain.DesignDiscipline;
import com.platform.core.design.domain.DesignOption;
import com.platform.core.design.domain.DesignOptionStatus;
import com.platform.core.design.dto.CreateDesignOptionRequest;
import com.platform.core.design.dto.DesignOptionDto;
import com.platform.core.design.repository.DesignOptionRepository;
import com.platform.core.iam.domain.DataClassification;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * 设计选项服务
 */
@Service
public class DesignOptionService {

    private final DesignOptionRepository optionRepository;
    private final ObjectMapper objectMapper;

    public DesignOptionService(DesignOptionRepository optionRepository, ObjectMapper objectMapper) {
        this.optionRepository = optionRepository;
        this.objectMapper = objectMapper;
    }

    /** 创建设计选项 */
    @Transactional
    public DesignOptionDto create(UUID tenantId, CreateDesignOptionRequest request, UUID userId) {
        DesignOption entity = new DesignOption();
        entity.setTenantId(tenantId);
        entity.setProjectId(request.projectId());
        entity.setTitle(request.title());
        entity.setDescription(request.description());
        entity.setStatus(DesignOptionStatus.DRAFT);
        entity.setDiscipline(request.discipline() != null ? request.discipline() : DesignDiscipline.ARCHITECTURE);
        entity.setClassification(DataClassification.PROJECT_RECORD);
        entity.setThumbnailDocumentId(request.thumbnailDocumentId());
        entity.setCreatedBy(userId);
        entity.setUpdatedBy(userId);

        if (request.metadata() != null) {
            entity.setMetadata(request.metadata());
        }

        DesignOption saved = optionRepository.save(entity);
        return toDto(saved);
    }

    /** 分页查询设计选项（按 status / discipline 是否为 null 走不同分支，规避 PostgreSQL 参数类型推断失败） */
    @Transactional(readOnly = true)
    public Page<DesignOptionDto> list(UUID tenantId, UUID projectId,
                                       DesignOptionStatus status, DesignDiscipline discipline,
                                       int page, int pageSize) {
        Pageable pageable = PageRequest.of(page - 1, pageSize);
        Page<DesignOption> result;
        if (status == null && discipline == null) {
            result = optionRepository.findByTenantIdAndProjectId(tenantId, projectId, pageable);
        } else if (status == null) {
            result = optionRepository.findByTenantIdAndProjectIdAndDiscipline(tenantId, projectId, discipline, pageable);
        } else if (discipline == null) {
            result = optionRepository.findByTenantIdAndProjectIdAndStatus(tenantId, projectId, status, pageable);
        } else {
            result = optionRepository.findByTenantIdAndProjectIdAndStatusAndDiscipline(
                    tenantId, projectId, status, discipline, pageable);
        }
        return result.map(this::toDto);
    }

    /** 查询设计选项详情 */
    @Transactional(readOnly = true)
    public DesignOptionDto get(UUID tenantId, UUID optionId) {
        DesignOption option = optionRepository.findByIdAndTenantId(optionId, tenantId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, "设计选项不存在"));
        return toDto(option);
    }

    private DesignOptionDto toDto(DesignOption e) {
        return new DesignOptionDto(
                e.getId(), e.getTenantId(), e.getProjectId(),
                e.getTitle(), e.getDescription(),
                e.getStatus(), e.getDiscipline(),
                e.getMetadata(), e.getThumbnailDocumentId(),
                e.getCreatedBy(), e.getCreatedAt(), e.getUpdatedAt(), e.getRowVersion()
        );
    }
}
