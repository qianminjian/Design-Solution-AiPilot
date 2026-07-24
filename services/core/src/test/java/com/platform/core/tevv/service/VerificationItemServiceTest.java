package com.platform.core.tevv.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.tevv.domain.VerificationItem;
import com.platform.core.tevv.domain.VerificationStatus;
import com.platform.core.tevv.domain.VerificationType;
import com.platform.core.tevv.dto.CreateVerificationItemRequest;
import com.platform.core.tevv.dto.VerificationItemDto;
import com.platform.core.tevv.repository.VerificationItemRepository;
import org.junit.jupiter.api.*;
import org.mockito.*;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 验证项服务测试
 */
class VerificationItemServiceTest {

    @Mock private VerificationItemRepository itemRepository;
    private VerificationItemService service;

    private UUID tenantId;
    private UUID userId;
    private UUID datasetId;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        service = new VerificationItemService(itemRepository);
        tenantId = UUID.randomUUID();
        userId = UUID.randomUUID();
        datasetId = UUID.randomUUID();
    }

    @Test
    @DisplayName("应该成功创建验证项")
    void shouldCreateItem() {
        when(itemRepository.save(any())).thenAnswer(inv -> {
            VerificationItem item = inv.getArgument(0);
            item.setId(UUID.randomUUID());
            return item;
        });

        CreateVerificationItemRequest request = new CreateVerificationItemRequest(
                datasetId, "G1-01", "规范合规检查", "描述", (short) 1, VerificationType.AUTOMATED, "HIGH"
        );

        VerificationItemDto dto = service.create(tenantId, request, userId);

        assertThat(dto.itemCode()).isEqualTo("G1-01");
        assertThat(dto.gateNumber()).isEqualTo((short) 1);
        assertThat(dto.verificationType()).isEqualTo(VerificationType.AUTOMATED);
        assertThat(dto.riskLevel()).isEqualTo("HIGH");
    }

    @Test
    @DisplayName("应该在 Gate 编号超范围时抛出异常")
    void shouldRejectInvalidGateNumber() {
        CreateVerificationItemRequest request = new CreateVerificationItemRequest(
                datasetId, "G7-01", "非法门号", null, (short) 7, VerificationType.MANUAL, null
        );

        assertThatThrownBy(() -> service.create(tenantId, request, userId))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode()).isEqualTo(ErrorCode.INVALID_GATE_NUMBER));
    }

    @Test
    @DisplayName("应该成功更新验证状态为 PASSED")
    void shouldUpdateStatusToPassed() {
        VerificationItem item = new VerificationItem();
        item.setId(UUID.randomUUID());
        item.setTenantId(tenantId);
        item.setStatus(VerificationStatus.PENDING);

        when(itemRepository.findById(item.getId())).thenReturn(Optional.of(item));
        when(itemRepository.save(any())).thenReturn(item);

        VerificationItemDto dto = service.updateStatus(tenantId, item.getId(), VerificationStatus.PASSED, userId, null);

        verify(itemRepository).save(argThat(i -> i.getStatus() == VerificationStatus.PASSED));
    }

    @Test
    @DisplayName("应该在 WAIVED 状态缺少原因时抛出异常")
    void shouldRejectWaiverWithoutReason() {
        VerificationItem item = new VerificationItem();
        item.setId(UUID.randomUUID());
        item.setTenantId(tenantId);
        item.setStatus(VerificationStatus.PENDING);

        when(itemRepository.findById(item.getId())).thenReturn(Optional.of(item));

        assertThatThrownBy(() -> service.updateStatus(tenantId, item.getId(), VerificationStatus.WAIVED, userId, null))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode()).isEqualTo(ErrorCode.WAIVER_REASON_REQUIRED));
    }

    @Test
    @DisplayName("应该在 WAIVED 状态提供原因时成功")
    void shouldAllowWaiverWithReason() {
        VerificationItem item = new VerificationItem();
        item.setId(UUID.randomUUID());
        item.setTenantId(tenantId);
        item.setStatus(VerificationStatus.PENDING);

        when(itemRepository.findById(item.getId())).thenReturn(Optional.of(item));
        when(itemRepository.save(any())).thenReturn(item);

        service.updateStatus(tenantId, item.getId(), VerificationStatus.WAIVED, userId, "低风险项，暂不验证");

        verify(itemRepository).save(argThat(i ->
                i.getStatus() == VerificationStatus.WAIVED && "低风险项，暂不验证".equals(i.getWaiverReason())
        ));
    }

    @Test
    @DisplayName("应该在验证项不存在时抛业务异常")
    void shouldThrowWhenItemNotFound() {
        UUID itemId = UUID.randomUUID();
        when(itemRepository.findById(itemId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateStatus(tenantId, itemId, VerificationStatus.PASSED, userId, null))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.VERIFICATION_ITEM_NOT_FOUND));
    }

    @Test
    @DisplayName("应该在跨租户访问验证项时抛业务异常")
    void shouldRejectCrossTenantItemAccess() {
        VerificationItem item = new VerificationItem();
        item.setId(UUID.randomUUID());
        item.setTenantId(UUID.randomUUID()); // 不同租户
        item.setStatus(VerificationStatus.PENDING);

        when(itemRepository.findById(item.getId())).thenReturn(Optional.of(item));

        UUID otherTenantId = tenantId;
        assertThatThrownBy(() -> service.updateStatus(otherTenantId, item.getId(), VerificationStatus.PASSED, userId, null))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.VERIFICATION_ITEM_NOT_FOUND));
    }

    @Test
    @DisplayName("应该在 Gate 编号为 0 时抛异常")
    void shouldRejectZeroGateNumber() {
        CreateVerificationItemRequest request = new CreateVerificationItemRequest(
                datasetId, "G0-01", "零门号", null, (short) 0, VerificationType.MANUAL, null
        );

        assertThatThrownBy(() -> service.create(tenantId, request, userId))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.INVALID_GATE_NUMBER));
    }

    @Test
    @DisplayName("应该在 Gate 编号为 null 时抛异常")
    void shouldRejectNullGateNumber() {
        CreateVerificationItemRequest request = new CreateVerificationItemRequest(
                datasetId, "G0-01", "空门号", null, null, VerificationType.MANUAL, null
        );

        assertThatThrownBy(() -> service.create(tenantId, request, userId))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.INVALID_GATE_NUMBER));
    }

    @Test
    @DisplayName("应该成功按数据集查询验证项列表")
    void shouldListByDataset() {
        VerificationItem item1 = new VerificationItem();
        item1.setId(UUID.randomUUID());
        item1.setDatasetId(datasetId);
        item1.setItemCode("G1-01");

        VerificationItem item2 = new VerificationItem();
        item2.setId(UUID.randomUUID());
        item2.setDatasetId(datasetId);
        item2.setItemCode("G1-02");

        when(itemRepository.findByTenantIdAndDatasetId(tenantId, datasetId)).thenReturn(List.of(item1, item2));

        List<VerificationItemDto> dtos = service.listByDataset(tenantId, datasetId);

        assertThat(dtos).hasSize(2);
        assertThat(dtos.get(0).itemCode()).isEqualTo("G1-01");
        assertThat(dtos.get(1).itemCode()).isEqualTo("G1-02");
    }

    @Test
    @DisplayName("应该正确统计数据集内指定状态的验证项数量")
    void shouldCountByStatus() {
        when(itemRepository.countByTenantIdAndDatasetIdAndStatus(tenantId, datasetId, VerificationStatus.PASSED))
                .thenReturn(5L);

        long count = service.countByStatus(tenantId, datasetId, VerificationStatus.PASSED);

        assertThat(count).isEqualTo(5L);
        verify(itemRepository).countByTenantIdAndDatasetIdAndStatus(tenantId, datasetId, VerificationStatus.PASSED);
    }

    @Test
    @DisplayName("应该在 riskLevel 为 null 时默认为 MEDIUM")
    void shouldDefaultRiskLevelToMediumWhenNull() {
        when(itemRepository.save(any())).thenAnswer(inv -> {
            VerificationItem item = inv.getArgument(0);
            item.setId(UUID.randomUUID());
            return item;
        });

        CreateVerificationItemRequest request = new CreateVerificationItemRequest(
                datasetId, "G1-01", "默认风险等级", null, (short) 1, VerificationType.AUTOMATED, null
        );

        VerificationItemDto dto = service.create(tenantId, request, userId);

        assertThat(dto.riskLevel()).isEqualTo("MEDIUM");
    }

    @Test
    @DisplayName("应该成功更新为 FAILED 状态")
    void shouldUpdateStatusToFailed() {
        VerificationItem item = new VerificationItem();
        item.setId(UUID.randomUUID());
        item.setTenantId(tenantId);
        item.setStatus(VerificationStatus.PENDING);

        when(itemRepository.findById(item.getId())).thenReturn(Optional.of(item));
        when(itemRepository.save(any())).thenReturn(item);

        service.updateStatus(tenantId, item.getId(), VerificationStatus.FAILED, userId, null);

        verify(itemRepository).save(argThat(i -> i.getStatus() == VerificationStatus.FAILED));
    }

    @Test
    @DisplayName("应该成功更新为 IN_PROGRESS 状态")
    void shouldUpdateStatusToInProgress() {
        VerificationItem item = new VerificationItem();
        item.setId(UUID.randomUUID());
        item.setTenantId(tenantId);
        item.setStatus(VerificationStatus.PENDING);

        when(itemRepository.findById(item.getId())).thenReturn(Optional.of(item));
        when(itemRepository.save(any())).thenReturn(item);

        service.updateStatus(tenantId, item.getId(), VerificationStatus.IN_PROGRESS, userId, null);

        verify(itemRepository).save(argThat(i -> i.getStatus() == VerificationStatus.IN_PROGRESS));
    }
}
