package com.platform.core.compliance.repository;

import com.platform.core.compliance.domain.RuleRevision;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RuleRevisionRepository extends JpaRepository<RuleRevision, UUID>, JpaSpecificationExecutor<RuleRevision> {

    Page<RuleRevision> findByTenantId(UUID tenantId, Pageable pageable);

    Page<RuleRevision> findByRuleId(UUID ruleId, Pageable pageable);

    List<RuleRevision> findByRuleIdOrderByRevisionNoDesc(UUID ruleId);

    Optional<RuleRevision> findByIdAndTenantId(UUID id, UUID tenantId);

    Optional<RuleRevision> findByRuleIdAndRevisionNo(UUID ruleId, Long revisionNo);

    Optional<RuleRevision> findFirstByRuleIdOrderByRevisionNoDesc(UUID ruleId);

    Long countByRuleId(UUID ruleId);
}