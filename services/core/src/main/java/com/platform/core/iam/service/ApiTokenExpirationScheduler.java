package com.platform.core.iam.service;

import com.platform.core.iam.domain.ApiToken;
import com.platform.core.iam.repository.ApiTokenRepository;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * IAM API Token 自动过期清理任务（A-64）
 *
 * <p>设计基线：对齐 security.md §1 "密钥 90 天轮换一次" 红线，确保过期 Token 不再被
 * 用于认证，避免安全合规风险。原 A-63 V0 差距记录第③项："Token 自动过期清理任务（定时
 * 扫描 status='active' 且 expires_at < NOW() 的 Token，更新为 status='expired'）待
 * V1.12+ 推进"。
 *
 * <p>调度策略：
 * <ul>
 *   <li>固定延迟 1 小时执行一次（token.cleanup.fixed-delay-seconds 默认 3600s）</li>
 *   <li>应用启动后延迟 60s 执行首次扫描（避免启动峰值叠加）</li>
 *   <li>单批最大处理量 500 条（token.cleanup.batch-size 默认 500）防止内存峰值</li>
 * </ul>
 *
 * <p>安全红线：
 * <ul>
 *   <li>仅更新 status='active' AND expires_at &lt; now 的 Token，避免误伤已撤销/已过期的记录</li>
 *   <li>事务边界明确（@Transactional），单批失败不影响下一批</li>
 *   <li>异常仅记录日志不抛出（对齐 A-59 健康检查失败不阻断主流程设计）</li>
 *   <li>批量 UPDATE 使用 @Modifying 避免逐条 save 的事务开销</li>
 * </ul>
 *
 * <p>对齐 design-constraints.md §OD-06 Hybrid-Site 部署画像：云控制面统一调度，所有租户
 * 共享同一调度器实例。
 *
 * @design security.md §1 密钥管理（90 天轮换 + 撤销机制）
 * @design design-constraints.md §OD-06 Hybrid-Site 部署画像
 */
@Service
public class ApiTokenExpirationScheduler {

    private static final Logger log = LoggerFactory.getLogger(ApiTokenExpirationScheduler.class);

    /** 单批默认处理量：500 条（避免一次性加载过多实体导致内存峰值） */
    private static final int DEFAULT_BATCH_SIZE = 500;

    private final ApiTokenRepository repository;

    /** 单批最大处理量，可通过环境变量 TOKEN_CLEANUP_BATCH_SIZE 调整 */
    private final int batchSize;

    public ApiTokenExpirationScheduler(
            ApiTokenRepository repository,
            @Value("${platform.security.token-cleanup.batch-size:500}") int batchSize
    ) {
        this.repository = repository;
        // 兜底：环境变量配置异常时使用默认值
        this.batchSize = batchSize > 0 ? batchSize : DEFAULT_BATCH_SIZE;
    }

    /**
     * 定时扫描过期 Token 并批量更新状态为 'expired'
     *
     * <p>调度表达式使用 fixedDelayString（秒），默认 3600s（1 小时）。
     * initialDelayString 默认 60s，避免应用启动峰值叠加。
     * 生产环境可通过环境变量 TOKEN_CLEANUP_FIXED_DELAY_SECONDS 调整。
     *
     * <p>对齐 testing.md §异常路径测试：异常仅记录日志不抛出，确保调度器不被中断。
     */
    @Scheduled(
            fixedDelayString = "${platform.security.token-cleanup.fixed-delay-seconds:3600}",
            initialDelayString = "${platform.security.token-cleanup.initial-delay-seconds:60}"
    )
    @Transactional
    public void markExpiredTokens() {
        Instant now = Instant.now();
        try {
            // 1. 查询已过期但状态仍为 active 的 Token（分页限制单批处理量）
            List<ApiToken> expiredTokens = repository.findExpiredActiveTokens(
                    now, PageRequest.of(0, batchSize));

            if (expiredTokens.isEmpty()) {
                log.debug("Token 过期清理任务：无过期 Token 需处理 now={}", now);
                return;
            }

            // 2. 批量 UPDATE：一次 SQL 完成所有过期 Token 的状态流转
            int affected = repository.bulkMarkExpired(now);

            // 3. 记录审计日志（脱敏 tokenHash 不打印，仅记录数量）
            log.info("Token 过期清理任务完成 expiredCount={} batchSize={} now={}",
                    affected, batchSize, now);

            // 4. 若本批处理量等于 batchSize，可能还有剩余过期 Token 待处理
            //    但不立即触发下一批（避免单次调度占用过长时间），等待下次定时调度
            if (affected >= batchSize) {
                log.info("Token 过期清理任务本批达到 batchSize 上限，可能有剩余 Token 待下次调度处理 batchSize={}",
                        batchSize);
            }
        } catch (Exception ex) {
            // 异常仅记录日志不抛出（对齐 A-59 设计：调度任务失败不阻断主流程）
            log.error("Token 过期清理任务异常 now={} cause={}", now, ex.getMessage(), ex);
        }
    }

    /**
     * 获取单批处理量（用于单元测试验证配置注入）
     */
    public int getBatchSize() {
        return batchSize;
    }
}
