package com.platform.core.iam.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * IAM API Token 实体（个人访问令牌 PAT）
 *
 * <p>安全红线（security.md §1）：
 * <ul>
 *   <li>token_hash 仅存 SHA-256 + 盐哈希，禁止明文存储</li>
 *   <li>明文 token 仅在创建时返回一次，前端必须立即复制保存</li>
 *   <li>撤销操作不可逆，仅更新 status，不物理删除（保留审计追溯）</li>
 *   <li>过期时间强制 ≤ 90 天</li>
 * </ul>
 */
@Entity
@Table(name = "api_tokens", schema = "iam")
public class ApiToken extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 关联主体 ID */
    @Column(name = "principal_id", nullable = false, updatable = false)
    private UUID principalId;

    /** Token 名称（用户可读） */
    @Column(name = "name", nullable = false, length = 100)
    private String name;

    /** 前缀（创建时生成，仅展示前 12 位用于识别） */
    @Column(name = "prefix", nullable = false, length = 12)
    private String prefix;

    /** SHA-256 + 盐哈希后的 token */
    @Column(name = "token_hash", nullable = false, length = 128)
    private String tokenHash;

    /** Token 独立盐值（防彩虹表） */
    @Column(name = "token_salt", nullable = false, length = 64)
    private String tokenSalt;

    /** 权限范围（JSON 数组，存为 text） */
    @Column(name = "scopes", nullable = false, columnDefinition = "jsonb")
    private String scopes;

    /** 状态：active / expired / revoked */
    @Column(name = "status", nullable = false, length = 20)
    private String status = "active";

    /** 过期时间（强制 ≤ 90 天） */
    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    /** 最后使用时间 */
    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    /** 撤销时间 */
    @Column(name = "revoked_at")
    private Instant revokedAt;

    /** 撤销原因 */
    @Column(name = "revoked_reason", length = 255)
    private String revokedReason;

    // ===== Getters / Setters =====

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getPrincipalId() {
        return principalId;
    }

    public void setPrincipalId(UUID principalId) {
        this.principalId = principalId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getPrefix() {
        return prefix;
    }

    public void setPrefix(String prefix) {
        this.prefix = prefix;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public void setTokenHash(String tokenHash) {
        this.tokenHash = tokenHash;
    }

    public String getTokenSalt() {
        return tokenSalt;
    }

    public void setTokenSalt(String tokenSalt) {
        this.tokenSalt = tokenSalt;
    }

    public String getScopes() {
        return scopes;
    }

    public void setScopes(String scopes) {
        this.scopes = scopes;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
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

    public Instant getRevokedAt() {
        return revokedAt;
    }

    public void setRevokedAt(Instant revokedAt) {
        this.revokedAt = revokedAt;
    }

    public String getRevokedReason() {
        return revokedReason;
    }

    public void setRevokedReason(String revokedReason) {
        this.revokedReason = revokedReason;
    }
}
