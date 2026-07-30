package com.platform.core.governance.auditlog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/**
 * 审计日志操作对象嵌入对象
 *
 * 与 BFF zod governanceAuditObjectSchema 对齐。
 */
@Embeddable
public class AuditObject {

    @Column(name = "object_type", nullable = false, length = 100)
    private String type;

    @Column(name = "object_id", nullable = false, length = 200)
    private String id;

    @Column(name = "object_name", nullable = false, length = 200)
    private String name;

    public AuditObject() {
    }

    public AuditObject(String type, String id, String name) {
        this.type = type;
        this.id = id;
        this.name = name;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
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
}
