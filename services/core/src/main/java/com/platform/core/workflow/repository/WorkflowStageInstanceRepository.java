package com.platform.core.workflow.repository;

import com.platform.core.workflow.domain.WorkflowStageInstance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WorkflowStageInstanceRepository extends JpaRepository<WorkflowStageInstance, UUID> {

    List<WorkflowStageInstance> findByProjectIdOrderByStageOrder(UUID projectId);

    List<WorkflowStageInstance> findByProjectIdAndStatus(UUID projectId, String status);

    Optional<WorkflowStageInstance> findByIdAndTenantId(UUID id, UUID tenantId);

    Optional<WorkflowStageInstance> findByProjectIdAndStageCode(UUID projectId, String stageCode);
}