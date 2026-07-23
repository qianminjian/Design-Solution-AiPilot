package com.platform.core.compliance.domain;

import com.platform.core.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.Where;
import org.hibernate.id.uuid.UuidGenerator;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "rule_revisions", schema = "compliance")
@Where(clause = "deleted_at IS NULL")
@GenericGenerator(name = "uuid_v7", type = UuidGenerator.class)
public class RuleRevision extends BaseEntity {

    @Id
    @GeneratedValue(generator = "uuid_v7")
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "rule_id", nullable = false)
    private UUID ruleId;

    @Column(name = "revision_no", nullable = false)
    private Long revisionNo;

    @Column(name = "dsl_json", nullable = false, columnDefinition = "jsonb")
    private String dslJson;

    @Column(name = "parameters_json", nullable = false, columnDefinition = "jsonb")
    private String parametersJson = "{}";

    @Column(name = "basis", nullable = false, columnDefinition = "jsonb")
    private String basis = "{}";

    @Column(name = "engine_profile")
    private String engineProfile;

    @Column(name = "status", nullable = false)
    private String status = "DRAFT";

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "deleted_by")
    private UUID deletedBy;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public void setTenantId(UUID tenantId) {
        this.tenantId = tenantId;
    }

    public UUID getRuleId() {
        return ruleId;
    }

    public void setRuleId(UUID ruleId) {
        this.ruleId = ruleId;
    }

    public Long getRevisionNo() {
        return revisionNo;
    }

    public void setRevisionNo(Long revisionNo) {
        this.revisionNo = revisionNo;
    }

    public String getDslJson() {
        return dslJson;
    }

    public void setDslJson(String dslJson) {
        this.dslJson = dslJson;
    }

    public String getParametersJson() {
        return parametersJson;
    }

    public void setParametersJson(String parametersJson) {
        this.parametersJson = parametersJson;
    }

    public String getBasis() {
        return basis;
    }

    public void setBasis(String basis) {
        this.basis = basis;
    }

    public String getEngineProfile() {
        return engineProfile;
    }

    public void setEngineProfile(String engineProfile) {
        this.engineProfile = engineProfile;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(Instant deletedAt) {
        this.deletedAt = deletedAt;
    }

    public UUID getDeletedBy() {
        return deletedBy;
    }

    public void setDeletedBy(UUID deletedBy) {
        this.deletedBy = deletedBy;
    }
}