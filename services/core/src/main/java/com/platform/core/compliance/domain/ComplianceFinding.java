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
@Table(name = "compliance_findings", schema = "compliance")
@GenericGenerator(name = "uuid_v7", type = UuidGenerator.class)
public class ComplianceFinding extends BaseEntity {

    @Id
    @GeneratedValue(generator = "uuid_v7")
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "result_id", nullable = false)
    private UUID resultId;

    @Column(name = "severity", nullable = false)
    private String severity = "MEDIUM";

    @Column(name = "status", nullable = false)
    private String status = "OPEN";

    @Column(name = "assigned_to")
    private UUID assignedTo;

    @Column(name = "note", columnDefinition = "text")
    private String note;

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

    public UUID getResultId() {
        return resultId;
    }

    public void setResultId(UUID resultId) {
        this.resultId = resultId;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public UUID getAssignedTo() {
        return assignedTo;
    }

    public void setAssignedTo(UUID assignedTo) {
        this.assignedTo = assignedTo;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }
}