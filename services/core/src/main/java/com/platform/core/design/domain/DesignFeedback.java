package com.platform.core.design.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import com.platform.core.iam.domain.DataClassification;
import jakarta.persistence.*;

import java.util.UUID;

/**
 * 设计反馈实体 — 评审意见与评分
 */
@Entity
@Table(name = "design_feedback")
public class DesignFeedback extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(nullable = false)
    private UUID optionId;

    @Column(nullable = false)
    private UUID authorId;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String comment;

    @Column
    private Integer rating;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private DataClassification classification = DataClassification.PROJECT_RECORD;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getOptionId() { return optionId; }
    public void setOptionId(UUID optionId) { this.optionId = optionId; }
    public UUID getAuthorId() { return authorId; }
    public void setAuthorId(UUID authorId) { this.authorId = authorId; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
    public Integer getRating() { return rating; }
    public void setRating(Integer rating) { this.rating = rating; }
    public DataClassification getClassification() { return classification; }
    public void setClassification(DataClassification classification) { this.classification = classification; }
}
