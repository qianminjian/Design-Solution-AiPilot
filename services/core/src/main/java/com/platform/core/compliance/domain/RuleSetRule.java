package com.platform.core.compliance.domain;

import com.platform.core.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;



import java.util.UUID;

@Entity
@Table(name = "rule_set_rules", schema = "compliance")
public class RuleSetRule extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "rule_set_id", nullable = false)
    private UUID ruleSetId;

    @Column(name = "revision_id", nullable = false)
    private UUID revisionId;

    @Column(name = "priority", nullable = false)
    private Integer priority = 1;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getRuleSetId() {
        return ruleSetId;
    }

    public void setRuleSetId(UUID ruleSetId) {
        this.ruleSetId = ruleSetId;
    }

    public UUID getRevisionId() {
        return revisionId;
    }

    public void setRevisionId(UUID revisionId) {
        this.revisionId = revisionId;
    }

    public Integer getPriority() {
        return priority;
    }

    public void setPriority(Integer priority) {
        this.priority = priority;
    }
}