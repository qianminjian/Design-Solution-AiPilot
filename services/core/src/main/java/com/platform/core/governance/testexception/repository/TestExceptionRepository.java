package com.platform.core.governance.testexception.repository;

import com.platform.core.governance.testexception.domain.TestException;
import com.platform.core.governance.testexception.domain.TestExceptionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 测试例外 Repository（D45.22 / D45.25，SIT P0-13.3）
 *
 * 支持按租户分页、状态过滤与到期批量撤销（Conditional Pass 到期自动撤销）。
 */
@Repository
public interface TestExceptionRepository
        extends JpaRepository<TestException, UUID>,
        JpaSpecificationExecutor<TestException> {

    Page<TestException> findByTenantId(UUID tenantId, Pageable pageable);

    Page<TestException> findByTenantIdAndStatus(UUID tenantId, TestExceptionStatus status, Pageable pageable);

    /** 到期未撤销的 ACTIVE 例外（Conditional Pass 到期自动撤销） */
    @Query("SELECT t FROM TestException t WHERE t.status = :status AND t.expiry < :now")
    List<TestException> findExpiredByStatus(@Param("status") TestExceptionStatus status, @Param("now") Instant now);

    /** 批量撤销到期例外 */
    @Modifying
    @Query("UPDATE TestException t SET t.status = :target, t.updatedAt = :now "
            + "WHERE t.status = :source AND t.expiry < :now")
    int bulkMarkExpired(
            @Param("source") TestExceptionStatus source,
            @Param("target") TestExceptionStatus target,
            @Param("now") Instant now);
}
