package com.platform.core.governance.accessgrant.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import com.platform.core.governance.domain.enums.GovernanceAccessGrantStatus;
import com.platform.core.governance.domain.enums.GovernanceAccessGrantType;
import com.platform.core.governance.domain.enums.GovernanceRiskLevel;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * 治理域访问授权实体（D37.17 Access Review）
 *
 * 与 iam.domain.AccessGrant 互补：
 *  - iam 域：细粒度权限授权（principal + permission + resource + effect）
 *  - governance 域：高风险授权治理（含风险等级、Step-Up、Legal Hold、有效期管理）
 *
 * 表：governance.access_grant
 */
@Entity(name = "GovernanceAccessGrant")
@Table(name = "access_grant", schema = "governance")
public class AccessGrant extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 授权类型：MEMBER / EXTERNAL / SERVICE / BREAKGLASS */
    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 32)
    private GovernanceAccessGrantType type;

    @Column(name = "principal_name", nullable = false, length = 200)
    private String principalName;

    @Column(name = "principal_email", nullable = false, length = 320)
    private String principalEmail;

    /** 资源标识（资源类型:资源ID 格式或资源路径） */
    @Column(name = "resource", nullable = false, length = 500)
    private String resource;

    /** 权限名称（如 project:read / design:approve） */
    @Column(name = "permission", nullable = false, length = 200)
    private String permission;

    /** 风险等级 */
    @Enumerated(EnumType.STRING)
    @Column(name = "risk_level", nullable = false, length = 16)
    private GovernanceRiskLevel riskLevel;

    /** 授权状态 */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private GovernanceAccessGrantStatus status;

    /** 授权发起人（用户 ID 或名称） */
    @Column(name = "granted_by", nullable = false, length = 200)
    private String grantedBy;

    @Column(name = "granted_at", nullable = false)
    private Instant grantedAt;

    /** 过期时间（必须设置，break-glass 也不能无限期） */
    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    /** 最近一次使用时间（用于检测僵尸授权） */
    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    /** 资源 owner（用于通知与复核） */
    @Column(name = "owner", nullable = false, length = 200)
    private String owner;

    @Column(name = "owner_email", nullable = false, length = 320)
    private String ownerEmail;

    /** 授权理由（创建时必填，审批依据） */
    @Column(name = "reason", nullable = false, length = 1000)
    private String reason;

    /** 是否需要 Step-Up 认证才能执行操作 */
    @Column(name = "requires_step_up", nullable = false)
    private boolean requiresStepUp;

    /** 是否被 Legal Hold（法律保留，禁止删除） */
    @Column(name = "has_legal_hold")
    private boolean hasLegalHold;

    /** 传播依赖（JSON 数组，记录下游依赖该授权的资源 ID 列表） */
    @Column(name = "propagation_dependents", columnDefinition = "jsonb")
    private String propagationDependents = "[]";

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public GovernanceAccessGrantType getType() {
        return type;
    }

    public void setType(GovernanceAccessGrantType type) {
        this.type = type;
    }

    public String getPrincipalName() {
        return principalName;
    }

    public void setPrincipalName(String principalName) {
        this.principalName = principalName;
    }

    public String getPrincipalEmail() {
        return principalEmail;
    }

    public void setPrincipalEmail(String principalEmail) {
        this.principalEmail = principalEmail;
    }

    public String getResource() {
        return resource;
    }

    public void setResource(String resource) {
        this.resource = resource;
    }

    public String getPermission() {
        return permission;
    }

    public void setPermission(String permission) {
        this.permission = permission;
    }

    public GovernanceRiskLevel getRiskLevel() {
        return riskLevel;
    }

    public void setRiskLevel(GovernanceRiskLevel riskLevel) {
        this.riskLevel = riskLevel;
    }

    public GovernanceAccessGrantStatus getStatus() {
        return status;
    }

    public void setStatus(GovernanceAccessGrantStatus status) {
        this.status = status;
    }

    public String getGrantedBy() {
        return grantedBy;
    }

    public void setGrantedBy(String grantedBy) {
        this.grantedBy = grantedBy;
    }

    public Instant getGrantedAt() {
        return grantedAt;
    }

    public void setGrantedAt(Instant grantedAt) {
        this.grantedAt = grantedAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public Instant getLastUsedAt() {
        return lastUsedAt;
    }

    public void setLastUsedAt(Instant lastUsedAt) {
        this.lastUsedAt = lastUsedAt;
    }

    public String getOwner() {
        return owner;
    }

    public void setOwner(String owner) {
        this.owner = owner;
    }

    public String getOwnerEmail() {
        return ownerEmail;
    }

    public void setOwnerEmail(String ownerEmail) {
        this.ownerEmail = ownerEmail;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public boolean isRequiresStepUp() {
        return requiresStepUp;
    }

    public void setRequiresStepUp(boolean requiresStepUp) {
        this.requiresStepUp = requiresStepUp;
    }

    public boolean isHasLegalHold() {
        return hasLegalHold;
    }

    public void setHasLegalHold(boolean hasLegalHold) {
        this.hasLegalHold = hasLegalHold;
    }

    public String getPropagationDependents() {
        return propagationDependents;
    }

    public void setPropagationDependents(String propagationDependents) {
        this.propagationDependents = propagationDependents;
    }
}
