package com.platform.core.design.repository;

import com.platform.core.design.domain.DesignFeedback;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/**
 * 设计反馈仓储
 */
public interface DesignFeedbackRepository extends JpaRepository<DesignFeedback, UUID> {

    /** 按选项ID查询反馈，按创建时间倒序 */
    List<DesignFeedback> findByOptionIdOrderByCreatedAtDesc(UUID optionId);
}
