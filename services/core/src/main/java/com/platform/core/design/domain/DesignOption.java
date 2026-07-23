package com.platform.core.design.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import com.platform.core.iam.domain.DataClassification;
import jakarta.persistence.*;

import java.util.UUID;

/**
 * 设计选项实体 — 方案候选轮
 *
 * 状态机：draft → candidate → submitted → (accepted | returned) → archived
 */
@Entity
@Table(name = "design_option")
public class DesignOption extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(nullable = false)
    private UUID projectId;

    @Column(nullable = false, length = 256)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private DesignOptionStatus status = DesignOptionStatus.DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private DesignDiscipline discipline = DesignDiscipline.ARCHITECTURE;

    @Column(columnDefinition = "jsonb")
    private String metadata;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private DataClassification classification = DataClassification.PROJECT_RECORD;

    @Column
    private UUID thumbnailDocumentId;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getProjectId() { return projectId; }
    public void setProjectId(UUID projectId) { this.projectId = projectId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public DesignOptionStatus getStatus() { return status; }
    public void setStatus(DesignOptionStatus status) { this.status = status; }
    public DesignDiscipline getDiscipline() { return discipline; }
    public void setDiscipline(DesignDiscipline discipline) { this.discipline = discipline; }
    public String getMetadata() { return metadata; }
    public void setMetadata(String metadata) { this.metadata = metadata; }
    public DataClassification getClassification() { return classification; }
    public void setClassification(DataClassification classification) { this.classification = classification; }
    public UUID getThumbnailDocumentId() { return thumbnailDocumentId; }
    public void setThumbnailDocumentId(UUID thumbnailDocumentId) { this.thumbnailDocumentId = thumbnailDocumentId; }
}
