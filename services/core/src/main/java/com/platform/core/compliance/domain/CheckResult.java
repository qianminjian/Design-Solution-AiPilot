package com.platform.core.compliance.domain;

import com.platform.core.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.id.uuid.UuidGenerator;

import java.util.UUID;

@Entity
@Table(name = "check_results", schema = "compliance")
@GenericGenerator(name = "uuid_v7", type = UuidGenerator.class)
public class CheckResult extends BaseEntity {

    @Id
    @GeneratedValue(generator = "uuid_v7")
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "execution_id", nullable = false)
    private UUID executionId;

    @Column(name = "object_id")
    private UUID objectId;

    @Column(name = "object_type")
    private String objectType;

    @Column(name = "outcome", nullable = false)
    private String outcome;

    @Column(name = "measured_value", columnDefinition = "text")
    private String measuredValue;

    @Column(name = "threshold", columnDefinition = "text")
    private String threshold;

    @Column(name = "explanation", columnDefinition = "text")
    private String explanation;

    @Column(name = "evidence_json", nullable = false, columnDefinition = "jsonb")
    private String evidenceJson = "{}";

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

    public UUID getExecutionId() {
        return executionId;
    }

    public void setExecutionId(UUID executionId) {
        this.executionId = executionId;
    }

    public UUID getObjectId() {
        return objectId;
    }

    public void setObjectId(UUID objectId) {
        this.objectId = objectId;
    }

    public String getObjectType() {
        return objectType;
    }

    public void setObjectType(String objectType) {
        this.objectType = objectType;
    }

    public String getOutcome() {
        return outcome;
    }

    public void setOutcome(String outcome) {
        this.outcome = outcome;
    }

    public String getMeasuredValue() {
        return measuredValue;
    }

    public void setMeasuredValue(String measuredValue) {
        this.measuredValue = measuredValue;
    }

    public String getThreshold() {
        return threshold;
    }

    public void setThreshold(String threshold) {
        this.threshold = threshold;
    }

    public String getExplanation() {
        return explanation;
    }

    public void setExplanation(String explanation) {
        this.explanation = explanation;
    }

    public String getEvidenceJson() {
        return evidenceJson;
    }

    public void setEvidenceJson(String evidenceJson) {
        this.evidenceJson = evidenceJson;
    }
}