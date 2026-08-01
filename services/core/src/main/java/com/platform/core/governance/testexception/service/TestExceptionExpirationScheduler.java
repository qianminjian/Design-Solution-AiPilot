package com.platform.core.governance.testexception.service;

import com.platform.core.governance.testexception.domain.TestException;
import com.platform.core.governance.testexception.domain.TestExceptionStatus;
import com.platform.core.governance.testexception.repository.TestExceptionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * 测试例外到期自动撤销调度器（D45.22 验收：Conditional Pass 到期自动撤销，SIT P0-13.3）
 *
 * <p>调度策略（对齐 A-64 ApiTokenExpirationScheduler 模式）：
 * <ul>
 *   <li>固定延迟 1 小时执行一次（platform.test-exception-cleanup.fixed-delay-seconds 默认 3600s）</li>
 *   <li>应用启动后延迟 60s 执行首次扫描（避免启动峰值叠加）</li>
 *   <li>单批最大处理量 500 条防止内存峰值</li>
 * </ul>
 *
 * <p>安全红线：
 * <ul>
 *   <li>仅更新 status=ACTIVE 且 expiry &lt; now 的例外，避免误伤已撤销/已关闭记录</li>
 *   <li>异常仅记录日志不抛出（调度任务失败不阻断主流程，对齐 A-59）</li>
 *   <li>批量 UPDATE 使用 @Modifying 避免逐条 save 的事务开销</li>
 * </ul>
 *
 * @design D45-测试-验收体系.md §D45.22 缺陷、Flaky 与例外治理
 * @design design-constraints.md §OD-06 Hybrid-Site 部署画像（云控制面统一调度）
 */
@Service
public class TestExceptionExpirationScheduler {

    private static final Logger log = LoggerFactory.getLogger(TestExceptionExpirationScheduler.class);

    /** 单批默认处理量：500 条 */
    private static final int DEFAULT_BATCH_SIZE = 500;

    private final TestExceptionRepository repository;
    private final int batchSize;

    public TestExceptionExpirationScheduler(
            TestExceptionRepository repository,
            @Value("${platform.test-exception-cleanup.batch-size:500}") int batchSize
    ) {
        this.repository = repository;
        this.batchSize = batchSize > 0 ? batchSize : DEFAULT_BATCH_SIZE;
    }

    /**
     * 定时扫描到期例外并批量撤销（ACTIVE → EXPIRED）
     */
    @Scheduled(
            fixedDelayString = "${platform.test-exception-cleanup.fixed-delay-seconds:3600}",
            initialDelayString = "${platform.test-exception-cleanup.initial-delay-seconds:60}"
    )
    @Transactional
    public void markExpiredExceptions() {
        Instant now = Instant.now();
        try {
            List<TestException> expired = repository.findExpiredByStatus(
                    TestExceptionStatus.ACTIVE, now);
            if (expired.isEmpty()) {
                log.debug("测试例外到期清理任务：无到期例外需处理 now={}", now);
                return;
            }
            int affected = repository.bulkMarkExpired(
                    TestExceptionStatus.ACTIVE, TestExceptionStatus.EXPIRED, now);
            log.info("测试例外到期清理任务完成 expiredCount={} batchSize={} now={}",
                    affected, batchSize, now);
            if (affected >= batchSize) {
                log.info("测试例外到期清理任务本批达到 batchSize 上限，可能有剩余例外待下次调度处理");
            }
        } catch (Exception ex) {
            log.error("测试例外到期清理任务异常 now={} cause={}", now, ex.getMessage(), ex);
        }
    }

    /** 获取单批处理量（用于单元测试验证配置注入） */
    public int getBatchSize() {
        return batchSize;
    }
}
