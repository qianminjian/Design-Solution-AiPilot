package com.platform.core.compliance.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.compliance.domain.ComplianceFinding;
import com.platform.core.compliance.dto.ComplianceFindingDto;
import com.platform.core.compliance.dto.CreateFindingRequest;
import com.platform.core.compliance.dto.FindingCommandRequest;
import com.platform.core.compliance.repository.ComplianceFindingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 合规发现服务单元测试（D45.22 缺陷治理 / D45.25 Finding API，SIT P0-13.1）
 *
 * <p>覆盖：查询、分页列表、命令更新（ASSIGN/VERIFY/CLOSE/REOPEN/ESCALATE/FIXED）、
 * 属性更新、创建、独立复测（retest + CRITICAL 独立复测校验）、4 等级发布规则。
 *
 * <p>权威源：FindingService.java + D45.22 + D45.25
 */
@ExtendWith(MockitoExtension.class)
class FindingServiceTest {

    @Mock
    private ComplianceFindingRepository findingRepository;

    private FindingService service;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID findingId = UUID.randomUUID();
    private final UUID resultId = UUID.randomUUID();
    private final UUID assignedTo = UUID.randomUUID();
    private final UUID owner = UUID.randomUUID();
    private final UUID verifier = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new FindingService(findingRepository);
    }

    @Nested
    @DisplayName("getFinding 查询合规发现")
    class GetFinding {

        @Test
        @DisplayName("应该返回合规发现 DTO")
        void shouldReturnDto() {
            // Arrange
            ComplianceFinding finding = buildFinding();
            when(findingRepository.findById(findingId)).thenReturn(Optional.of(finding));

            // Act
            ComplianceFindingDto dto = service.getFinding(tenantId, findingId);

            // Assert
            assertThat(dto.id()).isEqualTo(findingId);
            assertThat(dto.severity()).isEqualTo("MEDIUM");
            assertThat(dto.status()).isEqualTo("OPEN");
        }

        @Test
        @DisplayName("不存在的 ID 应该抛出 FINDING_NOT_FOUND 异常")
        void notFoundShouldThrow() {
            // Arrange
            when(findingRepository.findById(findingId)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.getFinding(tenantId, findingId))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("合规发现不存在");
        }

        @Test
        @DisplayName("租户不匹配应该抛出 FINDING_NOT_FOUND 异常")
        void tenantMismatchShouldThrow() {
            // Arrange
            ComplianceFinding finding = buildFinding();
            finding.setTenantId(UUID.randomUUID());
            when(findingRepository.findById(findingId)).thenReturn(Optional.of(finding));

            // Act & Assert
            assertThatThrownBy(() -> service.getFinding(tenantId, findingId))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("合规发现不存在");
        }
    }

    @Nested
    @DisplayName("listFindings 分页查询")
    class ListFindings {

        @Test
        @DisplayName("按 severity 过滤应该调用对应仓库方法")
        void shouldFilterBySeverity() {
            // Arrange
            Pageable pageable = PageRequest.of(0, 10);
            Page<ComplianceFinding> page = new PageImpl<>(List.of(buildFinding()));
            when(findingRepository.findByTenantIdAndSeverity(tenantId, "HIGH", pageable)).thenReturn(page);

            // Act
            Page<ComplianceFindingDto> result = service.listFindings(tenantId, "HIGH", null, null, pageable);

            // Assert
            assertThat(result.getContent()).hasSize(1);
            verify(findingRepository).findByTenantIdAndSeverity(tenantId, "HIGH", pageable);
        }

        @Test
        @DisplayName("按 status 过滤应该调用对应仓库方法")
        void shouldFilterByStatus() {
            // Arrange
            Pageable pageable = PageRequest.of(0, 10);
            Page<ComplianceFinding> page = new PageImpl<>(List.of(buildFinding()));
            when(findingRepository.findByTenantIdAndStatus(tenantId, "OPEN", pageable)).thenReturn(page);

            // Act
            Page<ComplianceFindingDto> result = service.listFindings(tenantId, null, "OPEN", null, pageable);

            // Assert
            assertThat(result.getContent()).hasSize(1);
            verify(findingRepository).findByTenantIdAndStatus(tenantId, "OPEN", pageable);
        }

        @Test
        @DisplayName("按 assignedTo 过滤应该调用对应仓库方法")
        void shouldFilterByAssignedTo() {
            // Arrange
            Pageable pageable = PageRequest.of(0, 10);
            Page<ComplianceFinding> page = new PageImpl<>(List.of(buildFinding()));
            when(findingRepository.findByTenantIdAndAssignedTo(tenantId, assignedTo, pageable)).thenReturn(page);

            // Act
            Page<ComplianceFindingDto> result = service.listFindings(tenantId, null, null, assignedTo, pageable);

            // Assert
            assertThat(result.getContent()).hasSize(1);
            verify(findingRepository).findByTenantIdAndAssignedTo(tenantId, assignedTo, pageable);
        }

        @Test
        @DisplayName("无过滤条件应该查询全部")
        void shouldQueryAllWhenNoFilter() {
            // Arrange
            Pageable pageable = PageRequest.of(0, 10);
            Page<ComplianceFinding> page = new PageImpl<>(List.of(buildFinding()));
            when(findingRepository.findByTenantId(tenantId, pageable)).thenReturn(page);

            // Act
            Page<ComplianceFindingDto> result = service.listFindings(tenantId, null, null, null, pageable);

            // Assert
            assertThat(result.getContent()).hasSize(1);
            verify(findingRepository).findByTenantId(tenantId, pageable);
        }
    }

    @Nested
    @DisplayName("updateFinding 命令更新")
    class UpdateFinding {

        @Test
        @DisplayName("ASSIGN 命令应该设置状态为 IN_PROGRESS")
        void assignCommandShouldSetStatus() {
            // Arrange
            ComplianceFinding finding = buildFinding();
            when(findingRepository.findById(findingId)).thenReturn(Optional.of(finding));
            when(findingRepository.save(any())).thenReturn(finding);

            // Act
            service.updateFinding(tenantId, findingId, command("ASSIGN", null, null));

            // Assert
            assertThat(finding.getStatus()).isEqualTo("IN_PROGRESS");
            verify(findingRepository).save(finding);
        }

        @Test
        @DisplayName("VERIFY 命令应该设置状态为 VERIFIED 且根因为 FIXED")
        void verifyCommandShouldSetStatus() {
            // Arrange
            ComplianceFinding finding = buildFinding();
            when(findingRepository.findById(findingId)).thenReturn(Optional.of(finding));
            when(findingRepository.save(any())).thenReturn(finding);

            // Act
            service.updateFinding(tenantId, findingId, command("VERIFY", null, null));

            // Assert
            assertThat(finding.getStatus()).isEqualTo("VERIFIED");
            assertThat(finding.getRootState()).isEqualTo("FIXED");
        }

        @Test
        @DisplayName("CLOSE 命令应该设置状态为 CLOSED")
        void closeCommandShouldSetStatus() {
            // Arrange
            ComplianceFinding finding = buildFinding();
            when(findingRepository.findById(findingId)).thenReturn(Optional.of(finding));
            when(findingRepository.save(any())).thenReturn(finding);

            // Act
            service.updateFinding(tenantId, findingId, command("CLOSE", null, null));

            // Assert
            assertThat(finding.getStatus()).isEqualTo("CLOSED");
        }

        @Test
        @DisplayName("REOPEN 命令应该设置状态为 OPEN")
        void reopenCommandShouldSetStatus() {
            // Arrange
            ComplianceFinding finding = buildFinding();
            finding.setStatus("CLOSED");
            when(findingRepository.findById(findingId)).thenReturn(Optional.of(finding));
            when(findingRepository.save(any())).thenReturn(finding);

            // Act
            service.updateFinding(tenantId, findingId, command("REOPEN", null, null));

            // Assert
            assertThat(finding.getStatus()).isEqualTo("OPEN");
        }

        @Test
        @DisplayName("ESCALATE 命令 MEDIUM 应该升级为 HIGH")
        void escalateMediumShouldUpgradeToHigh() {
            // Arrange
            ComplianceFinding finding = buildFinding();
            finding.setSeverity("MEDIUM");
            when(findingRepository.findById(findingId)).thenReturn(Optional.of(finding));
            when(findingRepository.save(any())).thenReturn(finding);

            // Act
            service.updateFinding(tenantId, findingId, command("ESCALATE", null, null));

            // Assert
            assertThat(finding.getStatus()).isEqualTo("IN_PROGRESS");
            assertThat(finding.getSeverity()).isEqualTo("HIGH");
        }

        @Test
        @DisplayName("ESCALATE 命令 HIGH 应该升级为 CRITICAL")
        void escalateHighShouldUpgradeToCritical() {
            // Arrange
            ComplianceFinding finding = buildFinding();
            finding.setSeverity("HIGH");
            when(findingRepository.findById(findingId)).thenReturn(Optional.of(finding));
            when(findingRepository.save(any())).thenReturn(finding);

            // Act
            service.updateFinding(tenantId, findingId, command("ESCALATE", null, null));

            // Assert
            assertThat(finding.getSeverity()).isEqualTo("CRITICAL");
        }

        @Test
        @DisplayName("FIXED 命令缺少 fix 应拒绝")
        void fixedCommandWithoutFixShouldThrow() {
            // Arrange
            ComplianceFinding finding = buildFinding();
            when(findingRepository.findById(findingId)).thenReturn(Optional.of(finding));

            // Act & Assert
            assertThatThrownBy(() -> service.updateFinding(tenantId, findingId, command("FIXED", null, null)))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("fix");
            verify(findingRepository, never()).save(any());
        }

        @Test
        @DisplayName("FIXED 命令应设置状态 FIXED 且保存修复方案")
        void fixedCommandShouldSetStatusAndFix() {
            // Arrange
            ComplianceFinding finding = buildFinding();
            when(findingRepository.findById(findingId)).thenReturn(Optional.of(finding));
            when(findingRepository.save(any())).thenReturn(finding);

            // Act
            service.updateFinding(tenantId, findingId,
                    new FindingCommandRequest("FIXED", null, null, null, null, null, null, null,
                            null, null, null, "修复方案", null, null));

            // Assert
            assertThat(finding.getStatus()).isEqualTo("FIXED");
            assertThat(finding.getRootState()).isEqualTo("FIXED");
            assertThat(finding.getFix()).isEqualTo("修复方案");
        }

        @Test
        @DisplayName("未知命令应该抛出 PARAM_INVALID 异常")
        void unknownCommandShouldThrow() {
            // Arrange
            ComplianceFinding finding = buildFinding();
            when(findingRepository.findById(findingId)).thenReturn(Optional.of(finding));

            // Act & Assert
            assertThatThrownBy(() -> service.updateFinding(tenantId, findingId, command("UNKNOWN", null, null)))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("未知命令");
        }

        @Test
        @DisplayName("应该更新 assignedTo 和 note")
        void shouldUpdateAssignedToAndNote() {
            // Arrange
            ComplianceFinding finding = buildFinding();
            when(findingRepository.findById(findingId)).thenReturn(Optional.of(finding));
            when(findingRepository.save(any())).thenReturn(finding);

            // Act
            service.updateFinding(tenantId, findingId, command(null, assignedTo, "处理备注"));

            // Assert
            assertThat(finding.getAssignedTo()).isEqualTo(assignedTo);
            assertThat(finding.getNote()).isEqualTo("处理备注");
            verify(findingRepository).save(finding);
        }
    }

    @Nested
    @DisplayName("create 创建合规发现")
    class CreateFinding {

        @Test
        @DisplayName("应成功创建并持久化 Finding")
        void shouldCreateFinding() {
            // Arrange
            ComplianceFinding saved = buildFinding();
            saved.setId(findingId);
            when(findingRepository.save(any(ComplianceFinding.class))).thenAnswer(inv -> {
                ComplianceFinding f = inv.getArgument(0);
                f.setId(findingId);
                return f;
            });
            CreateFindingRequest request = new CreateFindingRequest(
                    "HIGH", "SAFETY", "疏散通道宽度不足", resultId,
                    "步骤1：打开三层平面；步骤2：测量疏散门净宽",
                    "GB50016 6.4.11", "A-03-平面图", assignedTo,
                    "IDENTIFIED", Instant.now().plusSeconds(86400));

            // Act
            ComplianceFindingDto dto = service.create(tenantId, request);

            // Assert
            assertThat(dto.id()).isEqualTo(findingId);
            assertThat(dto.severity()).isEqualTo("HIGH");
            assertThat(dto.category()).isEqualTo("SAFETY");
            assertThat(dto.affectedRequirement()).isEqualTo("GB50016 6.4.11");
            assertThat(dto.status()).isEqualTo("OPEN");
            verify(findingRepository).save(any(ComplianceFinding.class));
        }

        @Test
        @DisplayName("非法 severity 应拒绝创建")
        void invalidSeverityShouldThrow() {
            // Arrange
            CreateFindingRequest request = new CreateFindingRequest(
                    "BLOCKER", "SAFETY", "非法等级", null, null, null, null, null, null, null);

            // Act & Assert
            assertThatThrownBy(() -> service.create(tenantId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("severity");
            verify(findingRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("retest 独立复测")
    class RetestFinding {

        @Test
        @DisplayName("应成功复测并记录复测人与时间")
        void shouldRetest() {
            // Arrange
            ComplianceFinding finding = buildFinding();
            finding.setStatus("FIXED");
            finding.setOwner(owner);
            when(findingRepository.findById(findingId)).thenReturn(Optional.of(finding));
            when(findingRepository.save(any())).thenReturn(finding);

            // Act
            ComplianceFindingDto dto = service.retest(tenantId, findingId,
                    new FindingCommandRequest(null, null, null, null, null, null, null, null,
                            null, null, null, null, "复测通过", verifier));

            // Assert
            assertThat(dto.status()).isEqualTo("VERIFIED");
            assertThat(finding.getVerifiedBy()).isEqualTo(verifier);
            assertThat(finding.getVerifiedAt()).isNotNull();
            assertThat(finding.getRootState()).isEqualTo("FIXED");
        }

        @Test
        @DisplayName("缺少 verification 应拒绝")
        void missingVerificationShouldThrow() {
            // Act & Assert（参数校验先于 DB 查询，无需 stub）
            assertThatThrownBy(() -> service.retest(tenantId, findingId,
                    new FindingCommandRequest(null, null, null, null, null, null, null, null,
                            null, null, null, null, null, verifier)))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("verification");
        }

        @Test
        @DisplayName("缺少 verifiedBy 应拒绝")
        void missingVerifierShouldThrow() {
            // Act & Assert（参数校验先于 DB 查询，无需 stub）
            assertThatThrownBy(() -> service.retest(tenantId, findingId,
                    new FindingCommandRequest(null, null, null, null, null, null, null, null,
                            null, null, null, null, "复测通过", null)))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("verifiedBy");
        }

        @Test
        @DisplayName("CRITICAL 复测人与 owner 相同应拒绝（独立复测红线）")
        void criticalRetestByOwnerShouldThrow() {
            // Arrange
            ComplianceFinding finding = buildFinding();
            finding.setSeverity("CRITICAL");
            finding.setOwner(owner);
            when(findingRepository.findById(findingId)).thenReturn(Optional.of(finding));

            // Act & Assert
            assertThatThrownBy(() -> service.retest(tenantId, findingId,
                    new FindingCommandRequest(null, null, null, null, null, null, null, null,
                            null, null, null, null, "复测通过", owner)))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("独立复测");
            verify(findingRepository, never()).save(any());
        }

        @Test
        @DisplayName("CRITICAL 独立复测人不同应通过")
        void criticalRetestByIndependentVerifierShouldPass() {
            // Arrange
            ComplianceFinding finding = buildFinding();
            finding.setSeverity("CRITICAL");
            finding.setOwner(owner);
            when(findingRepository.findById(findingId)).thenReturn(Optional.of(finding));
            when(findingRepository.save(any())).thenReturn(finding);

            // Act
            ComplianceFindingDto dto = service.retest(tenantId, findingId,
                    new FindingCommandRequest(null, null, null, null, null, null, null, null,
                            null, null, null, null, "复测通过", verifier));

            // Assert
            assertThat(dto.status()).isEqualTo("VERIFIED");
            assertThat(finding.getVerifiedBy()).isEqualTo(verifier);
        }
    }

    @Nested
    @DisplayName("isReleaseBlocked 4 等级发布规则")
    class ReleaseBlocked {

        @Test
        @DisplayName("CRITICAL 未关闭应阻断发布")
        void criticalOpenShouldBlock() {
            // Arrange
            when(findingRepository.countByTenantIdAndSeverityAndStatusNot(tenantId, "CRITICAL", "CLOSED"))
                    .thenReturn(1L);

            // Act
            boolean blocked = service.isReleaseBlocked(tenantId);

            // Assert
            assertThat(blocked).isTrue();
        }

        @Test
        @DisplayName("HIGH 活跃应阻断发布")
        void highActiveShouldBlock() {
            // Arrange
            when(findingRepository.countByTenantIdAndSeverityAndStatusNot(tenantId, "CRITICAL", "CLOSED"))
                    .thenReturn(0L);
            when(findingRepository.countByTenantIdAndSeverityAndStatusIn(
                    tenantId, "HIGH", List.of("OPEN", "IN_PROGRESS"))).thenReturn(2L);

            // Act
            boolean blocked = service.isReleaseBlocked(tenantId);

            // Assert
            assertThat(blocked).isTrue();
        }

        @Test
        @DisplayName("无 CRITICAL 未关闭且无 HIGH 活跃应放行")
        void noBlockingFindingsShouldPass() {
            // Arrange
            when(findingRepository.countByTenantIdAndSeverityAndStatusNot(tenantId, "CRITICAL", "CLOSED"))
                    .thenReturn(0L);
            when(findingRepository.countByTenantIdAndSeverityAndStatusIn(
                    tenantId, "HIGH", List.of("OPEN", "IN_PROGRESS"))).thenReturn(0L);

            // Act
            boolean blocked = service.isReleaseBlocked(tenantId);

            // Assert
            assertThat(blocked).isFalse();
        }
    }

    /** 构造简化命令请求（仅 command/assignedTo/note） */
    private FindingCommandRequest command(String cmd, UUID assignee, String note) {
        return new FindingCommandRequest(cmd, assignee, note, null, null, null, null, null,
                null, null, null, null, null, null);
    }

    private ComplianceFinding buildFinding() {
        ComplianceFinding finding = new ComplianceFinding();
        finding.setId(findingId);
        finding.setTenantId(tenantId);
        finding.setResultId(resultId);
        finding.setSeverity("MEDIUM");
        finding.setStatus("OPEN");
        finding.setAssignedTo(null);
        finding.setNote(null);
        finding.setCreatedAt(Instant.now());
        finding.setUpdatedAt(Instant.now());
        finding.setRowVersion(1L);
        return finding;
    }
}
