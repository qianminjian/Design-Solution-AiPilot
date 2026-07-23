package com.platform.core.workflow.repository;

import com.platform.core.workflow.domain.WorkflowGateDecision;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WorkflowGateDecisionRepository extends JpaRepository<WorkflowGateDecision, UUID> {

    List<WorkflowGateDecision> findByProjectIdOrderByCreatedAtDesc(UUID projectId);

    List<WorkflowGateDecision> findByStageIdOrderByCreatedAtDesc(UUID stageId);

    List<WorkflowGateDecision> findByStageIdAndStatus(UUID stageId, String status);

    Optional<WorkflowGateDecision> findByIdAndTenantId(UUID id, UUID tenantId);
}