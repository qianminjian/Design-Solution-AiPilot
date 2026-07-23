package com.platform.core.compliance.repository;

import com.platform.core.compliance.domain.RuleSetRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RuleSetRuleRepository extends JpaRepository<RuleSetRule, UUID>, JpaSpecificationExecutor<RuleSetRule> {

    List<RuleSetRule> findByRuleSetIdOrderByPriorityAsc(UUID ruleSetId);

    List<RuleSetRule> findByRuleSetId(UUID ruleSetId);

    void deleteByRuleSetId(UUID ruleSetId);

    boolean existsByRuleSetIdAndRevisionId(UUID ruleSetId, UUID revisionId);
}