package com.platform.core.governance.testevidence.repository;

import com.platform.core.governance.testevidence.domain.TestEvidence;
import com.platform.core.governance.testevidence.domain.TestEvidenceType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 测试证据 Repository（P0-1.4）
 *
 * 支持按 testRunId / 类型 / 哈希查询，哈希查询用于证据校验
 * （D45.10 验收：证据 hash 可校验）。
 * 继承 JpaSpecificationExecutor 以支持租户过滤的分页查询。
 */
@Repository
public interface TestEvidenceRepository
        extends JpaRepository<TestEvidence, UUID>,
        JpaSpecificationExecutor<TestEvidence> {

    /** 按测试运行 ID 查询（对齐 P0-1.2 testRunId 标记机制） */
    List<TestEvidence> findByTestRunId(String testRunId);

    /** 按证据类型查询 */
    List<TestEvidence> findByEvidenceType(TestEvidenceType type);

    /** 按内容哈希精确查询（证据校验） */
    Optional<TestEvidence> findByHash(String hash);

    /** 按对象关联查询（如 releaseId） */
    List<TestEvidence> findByObjectIdAndObjectType(String objectId, String objectType);
}
