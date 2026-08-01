package com.platform.core.governance.flakycase.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

/**
 * Flaky Case 实体（D45.22 Flaky 治理，SIT P0-13.2）
 *
 * 检测机制（D45.22）：
 *  - Flaky Case 连续重复不稳定即隔离（连续 3 次结果翻转 → FLAKY）
 *  - 对应 Requirement 变为 Coverage Gap（isolate 时关联）
 *  - 保留替代确定性 TestCase 才可不阻断（replacementCaseId 非空则发布不阻断）
 *  - 修复必须有最小回归样本和根因分类（resolve 时必填）
 */
@Entity
@Table(name = "flaky_case", schema = "governance")
public class FlakyCase extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 状态：TRACKED/FLAKY/ISOLATED/RESOLVED */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private FlakyCaseStatus status = FlakyCaseStatus.TRACKED;

    /** 测试用例 ID（唯一标识） */
    @Column(name = "test_case_id", nullable = false, length = 200)
    private String testCaseId;

    /** 对应 Requirement ID（双向追踪，隔离后变 Coverage Gap） */
    @Column(name = "requirement_id", nullable = false, length = 200)
    private String requirementId;

    /** 总运行次数 */
    @Column(name = "run_count", nullable = false)
    private int runCount;

    /** 不稳定次数（结果翻转计数） */
    @Column(name = "instability_count", nullable = false)
    private int instabilityCount;

    /** 连续不稳定次数（连续 3 次触发隔离） */
    @Column(name = "consecutive_unstable", nullable = false)
    private int consecutiveUnstable;

    /** 上次运行结果（用于翻转检测） */
    @Column(name = "last_result")
    private Boolean lastResult;

    /** 根因分类（resolve 必填，如 ENV_DEPENDENT/TIMING/DATA_RACE/ORDER_DEPENDENT） */
    @Column(name = "root_cause", length = 500)
    private String rootCause;

    /** 最小回归样本引用（resolve 必填，如 testCaseId@commit） */
    @Column(name = "regression_sample", length = 1000)
    private String regressionSample;

    /** 替代确定性 TestCase ID（isolate 时提供则不阻断发布） */
    @Column(name = "replacement_case_id", length = 200)
    private String replacementCaseId;

    /** 关联测试运行 ID（对齐 P0-1.2 testRunId 标记机制） */
    @Column(name = "test_run_id", length = 64)
    private String testRunId;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public FlakyCaseStatus getStatus() {
        return status;
    }

    public void setStatus(FlakyCaseStatus status) {
        this.status = status;
    }

    public String getTestCaseId() {
        return testCaseId;
    }

    public void setTestCaseId(String testCaseId) {
        this.testCaseId = testCaseId;
    }

    public String getRequirementId() {
        return requirementId;
    }

    public void setRequirementId(String requirementId) {
        this.requirementId = requirementId;
    }

    public int getRunCount() {
        return runCount;
    }

    public void setRunCount(int runCount) {
        this.runCount = runCount;
    }

    public int getInstabilityCount() {
        return instabilityCount;
    }

    public void setInstabilityCount(int instabilityCount) {
        this.instabilityCount = instabilityCount;
    }

    public int getConsecutiveUnstable() {
        return consecutiveUnstable;
    }

    public void setConsecutiveUnstable(int consecutiveUnstable) {
        this.consecutiveUnstable = consecutiveUnstable;
    }

    public Boolean getLastResult() {
        return lastResult;
    }

    public void setLastResult(Boolean lastResult) {
        this.lastResult = lastResult;
    }

    public String getRootCause() {
        return rootCause;
    }

    public void setRootCause(String rootCause) {
        this.rootCause = rootCause;
    }

    public String getRegressionSample() {
        return regressionSample;
    }

    public void setRegressionSample(String regressionSample) {
        this.regressionSample = regressionSample;
    }

    public String getReplacementCaseId() {
        return replacementCaseId;
    }

    public void setReplacementCaseId(String replacementCaseId) {
        this.replacementCaseId = replacementCaseId;
    }

    public String getTestRunId() {
        return testRunId;
    }

    public void setTestRunId(String testRunId) {
        this.testRunId = testRunId;
    }
}
