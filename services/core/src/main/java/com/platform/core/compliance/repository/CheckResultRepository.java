package com.platform.core.compliance.repository;

import com.platform.core.compliance.domain.CheckResult;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CheckResultRepository extends JpaRepository<CheckResult, UUID>, JpaSpecificationExecutor<CheckResult> {

    List<CheckResult> findByExecutionId(UUID executionId);

    Page<CheckResult> findByExecutionId(UUID executionId, Pageable pageable);

    List<CheckResult> findByExecutionIdAndOutcome(UUID executionId, String outcome);

    long countByExecutionIdAndOutcome(UUID executionId, String outcome);
}