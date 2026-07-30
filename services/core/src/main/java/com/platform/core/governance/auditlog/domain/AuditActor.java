package com.platform.core.governance.auditlog.domain;

import com.platform.core.governance.domain.enums.GovernanceAuditActorType;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

/**
 * 审计日志执行者嵌入对象
 *
 * 与 BFF zod governanceAuditActorSchema 对齐。
 */
@Embeddable
public class AuditActor {

    @Column(name = "actor_id", nullable = false, length = 200)
    private String id;

    @Column(name = "actor_name", nullable = false, length = 200)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "actor_type", nullable = false, length = 16)
    private GovernanceAuditActorType type;

    public AuditActor() {
    }

    public AuditActor(String id, String name, GovernanceAuditActorType type) {
        this.id = id;
        this.name = name;
        this.type = type;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public GovernanceAuditActorType getType() {
        return type;
    }

    public void setType(GovernanceAuditActorType type) {
        this.type = type;
    }
}
