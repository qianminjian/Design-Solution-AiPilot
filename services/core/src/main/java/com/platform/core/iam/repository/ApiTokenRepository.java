package com.platform.core.iam.repository;

import com.platform.core.iam.domain.ApiToken;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * IAM API Token Repository
 */
@Repository
public interface ApiTokenRepository extends JpaRepository<ApiToken, UUID> {

    /**
     * 按主体 ID 查询所有 Token（按创建时间倒序）
     */
    List<ApiToken> findByPrincipalIdOrderByCreatedAtDesc(UUID principalId);

    /**
     * 按主体 ID + 名称查询（用于唯一性校验，仅 active 状态）
     */
    Optional<ApiToken> findByPrincipalIdAndNameAndStatus(UUID principalId, String name, String status);

    /**
     * 按 token_hash 查询（认证时使用，仅 active 状态）
     */
    Optional<ApiToken> findByTokenHashAndStatus(String tokenHash, String status);

    /**
     * 按 prefix 查询 active 状态的 Token 列表（P0-16.1 PAT 认证使用）
     *
     * <p>认证流程：明文 token 前 12 位作为 prefix 查询候选 Token，
     * 再逐个用其 tokenSalt 计算 SHA-256(salt + ":" + plainToken) 比对 tokenHash。
     * 因 prefix 长度 12 位（十六进制 48 bit），冲突概率极低，但仍需哈希比对确认。
     *
     * @param prefix Token 前 12 位（创建时生成）
     * @param status Token 状态（认证时传 "active"）
     * @return 候选 Token 列表（理论最多 1 条，冲突时多条）
     */
    List<ApiToken> findByPrefixAndStatus(String prefix, String status);

    /**
     * 批量查询已过期但状态仍为 active 的 Token（A-64 自动过期清理任务使用）
     *
     * <p>查询条件：status = 'active' AND expires_at < now
     * 使用 Pageable 限制单批处理量，防止一次性加载过多实体导致内存峰值。
     *
     * @param now    当前时间
     * @param limit  单批最大处理量
     * @return 已过期但未及时标记的 Token 列表
     */
    @Query("SELECT t FROM ApiToken t WHERE t.status = 'active' AND t.expiresAt < :now")
    List<ApiToken> findExpiredActiveTokens(@Param("now") Instant now, org.springframework.data.domain.Pageable limit);

    /**
     * 批量更新过期 Token 状态为 'expired'（A-64 自动过期清理任务使用）
     *
     * <p>使用 @Modifying + JPQL 批量 UPDATE 避免逐条 save 的事务开销。
     * 一次 UPDATE 完成所有过期 Token 的状态流转，仅刷新 updatedAt 时间戳，
     * 不触发 @LastModifiedDate 自动填充（因为 @Modifying 直接执行 SQL）。
     *
     * @param now    当前时间（用于填充 updatedAt）
     * @return 受影响行数
     */
    @Modifying
    @Query("UPDATE ApiToken t SET t.status = 'expired', t.updatedAt = :now " +
            "WHERE t.status = 'active' AND t.expiresAt < :now")
    int bulkMarkExpired(@Param("now") Instant now);
}
