package com.platform.core.compliance.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.compliance.domain.ComplianceFinding;
import com.platform.core.compliance.dto.ComplianceFindingDto;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 合规发现服务单元测试
 *
 * 覆盖：查询、分页列表、命令更新（ASSIGN/VERIFY/CLOSE/REOPEN/ESCALATE）、分配与备注更新。
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
            service.updateFinding(tenantId, findingId, new FindingCommandRequest("ASSIGN", null, null));

            // Assert
            assertThat(finding.getStatus()).isEqualTo("IN_PROGRESS");
            verify(findingRepository).save(finding);
        }

        @Test
        @DisplayName("VERIFY 命令应该设置状态为 VERIFIED")
        void verifyCommandShouldSetStatus() {
            // Arrange
            ComplianceFinding finding = buildFinding();
            when(findingRepository.findById(findingId)).thenReturn(Optional.of(finding));
            when(findingRepository.save(any())).thenReturn(finding);

            // Act
            service.updateFinding(tenantId, findingId, new FindingCommandRequest("VERIFY", null, null));

            // Assert
            assertThat(finding.getStatus()).isEqualTo("VERIFIED");
        }

        @Test
        @DisplayName("CLOSE 命令应该设置状态为 CLOSED")
        void closeCommandShouldSetStatus() {
            // Arrange
            ComplianceFinding finding = buildFinding();
            when(findingRepository.findById(findingId)).thenReturn(Optional.of(finding));
            when(findingRepository.save(any())).thenReturn(finding);

            // Act
            service.updateFinding(tenantId, findingId, new FindingCommandRequest("CLOSE", null, null));

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
            service.updateFinding(tenantId, findingId, new FindingCommandRequest("REOPEN", null, null));

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
            service.updateFinding(tenantId, findingId, new FindingCommandRequest("ESCALATE", null, null));

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
            service.updateFinding(tenantId, findingId, new FindingCommandRequest("ESCALATE", null, null));

            // Assert
            assertThat(finding.getSeverity()).isEqualTo("CRITICAL");
        }

        @Test
        @DisplayName("未知命令应该抛出 PARAM_INVALID 异常")
        void unknownCommandShouldThrow() {
            // Arrange
            ComplianceFinding finding = buildFinding();
            when(findingRepository.findById(findingId)).thenReturn(Optional.of(finding));

            // Act & Assert
            assertThatThrownBy(() -> service.updateFinding(tenantId, findingId,
                    new FindingCommandRequest("UNKNOWN", null, null)))
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
            service.updateFinding(tenantId, findingId,
                    new FindingCommandRequest(null, assignedTo, "处理备注"));

            // Assert
            assertThat(finding.getAssignedTo()).isEqualTo(assignedTo);
            assertThat(finding.getNote()).isEqualTo("处理备注");
            verify(findingRepository).save(finding);
        }
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
