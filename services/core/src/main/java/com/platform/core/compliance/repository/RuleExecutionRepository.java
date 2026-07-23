package com.platform.core.compliance.repository;

import com.platform.core.compliance.domain.RuleExecution;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RuleExecutionRepository extends JpaRepository<RuleExecution, UUID>, JpaSpecificationExecutor<RuleExecution> {

    List<RuleExecution> findByRunId(UUID runId);

    List<RuleExecution> findByRunIdOrderByStatus(UUID runId);
}