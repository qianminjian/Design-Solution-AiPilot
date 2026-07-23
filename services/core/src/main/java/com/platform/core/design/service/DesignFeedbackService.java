package com.platform.core.design.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.design.domain.DesignFeedback;
import com.platform.core.design.domain.DesignOption;
import com.platform.core.design.dto.DesignFeedbackDto;
import com.platform.core.design.dto.DesignFeedbackRequest;
import com.platform.core.design.repository.DesignFeedbackRepository;
import com.platform.core.design.repository.DesignOptionRepository;
import com.platform.core.iam.domain.DataClassification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * 设计反馈服务
 */
@Service
public class DesignFeedbackService {

    private final DesignFeedbackRepository feedbackRepository;
    private final DesignOptionRepository optionRepository;

    public DesignFeedbackService(DesignFeedbackRepository feedbackRepository,
                                  DesignOptionRepository optionRepository) {
        this.feedbackRepository = feedbackRepository;
        this.optionRepository = optionRepository;
    }

    /** 提交设计反馈 */
    @Transactional
    public DesignFeedbackDto submit(UUID tenantId, UUID optionId,
                                     DesignFeedbackRequest request, UUID userId) {
        DesignOption option = optionRepository.findByIdAndTenantId(optionId, tenantId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "设计选项不存在"));

        DesignFeedback entity = new DesignFeedback();
        entity.setTenantId(tenantId);
        entity.setOptionId(option.getId());
        entity.setAuthorId(userId);
        entity.setComment(request.comment());
        entity.setRating(request.rating());
        entity.setClassification(DataClassification.PROJECT_RECORD);
        entity.setCreatedBy(userId);
        entity.setUpdatedBy(userId);

        DesignFeedback saved = feedbackRepository.save(entity);
        return toDto(saved);
    }

    /** 查询设计选项的反馈列表 */
    @Transactional(readOnly = true)
    public List<DesignFeedbackDto> listByOption(UUID tenantId, UUID optionId) {
        DesignOption option = optionRepository.findByIdAndTenantId(optionId, tenantId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "设计选项不存在"));
        return feedbackRepository.findByOptionIdOrderByCreatedAtDesc(option.getId())
                .stream()
                .map(this::toDto)
                .toList();
    }

    private DesignFeedbackDto toDto(DesignFeedback e) {
        return new DesignFeedbackDto(
                e.getId(), e.getOptionId(), e.getAuthorId(),
                e.getComment(), e.getRating(), e.getCreatedAt()
        );
    }
}
