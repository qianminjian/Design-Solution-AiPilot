package com.platform.core.governance.flakycase.repository;

import com.platform.core.governance.flakycase.domain.FlakyCase;
import com.platform.core.governance.flakycase.domain.FlakyCaseStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Flaky Case Repository（D45.22 Flaky 治理，SIT P0-13.2）
 */
@Repository
public interface FlakyCaseRepository
        extends JpaRepository<FlakyCase, UUID>,
        JpaSpecificationExecutor<FlakyCase> {

    /** 按测试用例 ID 查询（幂等累计运行结果） */
    Optional<FlakyCase> findByTenantIdAndTestCaseId(UUID tenantId, String testCaseId);

    Page<FlakyCase> findByTenantId(UUID tenantId, Pageable pageable);

    Page<FlakyCase> findByTenantIdAndStatus(UUID tenantId, FlakyCaseStatus status, Pageable pageable);

    /** Flaky Case 率统计：不稳定/隔离数量 */
    long countByTenantIdAndStatusIn(UUID tenantId, java.util.Collection<FlakyCaseStatus> statuses);

    /** 总数统计 */
    long countByTenantId(UUID tenantId);
}
