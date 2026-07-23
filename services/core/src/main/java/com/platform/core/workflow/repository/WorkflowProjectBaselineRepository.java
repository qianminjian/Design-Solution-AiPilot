package com.platform.core.workflow.repository;

import com.platform.core.workflow.domain.WorkflowProjectBaseline;
import com.platform.core.workflow.domain.WorkflowRevisionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WorkflowProjectBaselineRepository extends JpaRepository<WorkflowProjectBaseline, UUID> {

    Optional<WorkflowProjectBaseline> findByIdAndTenantId(UUID id, UUID tenantId);

    List<WorkflowProjectBaseline> findByProjectIdOrderByRevisionNoDesc(UUID projectId);

    List<WorkflowProjectBaseline> findByProjectIdAndStatus(UUID projectId, String status);

    @Query("SELECT COALESCE(MAX(b.revisionNo), 0) FROM WorkflowProjectBaseline b WHERE b.projectId = :projectId")
    Long findMaxRevisionNoByProjectId(@Param("projectId") UUID projectId);

    boolean existsByProjectIdAndStatus(UUID projectId, WorkflowRevisionStatus status);
}