package com.platform.core.tevv.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.tevv.domain.*;
import com.platform.core.tevv.dto.CreateDatasetRequest;
import com.platform.core.tevv.dto.GoldenDatasetDto;
import com.platform.core.tevv.repository.GoldenDatasetRepository;
import org.junit.jupiter.api.*;
import org.mockito.*;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 金样数据集服务测试
 */
class GoldenDatasetServiceTest {

    @Mock private GoldenDatasetRepository datasetRepository;
    private GoldenDatasetService service;

    private UUID tenantId;
    private UUID userId;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        service = new GoldenDatasetService(datasetRepository);
        tenantId = UUID.randomUUID();
        userId = UUID.randomUUID();
    }

    // ── 创建数据集 ──

    @Nested
    @DisplayName("创建数据集")
    class CreateDataset {

        @Test
        @DisplayName("应该成功创建 DRAFT 状态数据集")
        void shouldCreateDraftDataset() {
            when(datasetRepository.existsByTenantIdAndNameAndVersion(any(), any(), any())).thenReturn(false);
            when(datasetRepository.save(any())).thenAnswer(inv -> {
                GoldenDataset ds = inv.getArgument(0);
                ds.setId(UUID.randomUUID());
                return ds;
            });

            CreateDatasetRequest request = new CreateDatasetRequest(
                    "办公楼金样", "描述", DatasetCategory.ARCHITECTURE, "OFFICE_MEDIUM", "s3://datasets/office"
            );

            GoldenDatasetDto dto = service.create(tenantId, request, userId);

            assertThat(dto.name()).isEqualTo("办公楼金样");
            assertThat(dto.status()).isEqualTo(DatasetStatus.DRAFT);
            assertThat(dto.category()).isEqualTo(DatasetCategory.ARCHITECTURE);
        }

        @Test
        @DisplayName("应该在名称+版本重复时抛出异常")
        void shouldRejectDuplicateName() {
            when(datasetRepository.existsByTenantIdAndNameAndVersion(any(), any(), any())).thenReturn(true);

            CreateDatasetRequest request = new CreateDatasetRequest(
                    "重复名称", null, DatasetCategory.ARCHITECTURE, "OFFICE_SMALL", "s3://key"
            );

            assertThatThrownBy(() -> service.create(tenantId, request, userId))
                    .isInstanceOf(BusinessException.class)
                    .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode()).isEqualTo(ErrorCode.DATASET_NAME_VERSION_EXISTS));
        }
    }

    // ── 冻结数据集 ──

    @Nested
    @DisplayName("冻结数据集")
    class FreezeDataset {

        @Test
        @DisplayName("应该成功冻结 DRAFT 数据集")
        void shouldFreezeDraftDataset() {
            GoldenDataset ds = new GoldenDataset();
            ds.setId(UUID.randomUUID());
            ds.setTenantId(tenantId);
            ds.setStatus(DatasetStatus.DRAFT);

            when(datasetRepository.findById(ds.getId())).thenReturn(Optional.of(ds));
            when(datasetRepository.save(any())).thenReturn(ds);

            GoldenDatasetDto dto = service.freeze(tenantId, ds.getId(), userId);

            assertThat(dto.status()).isEqualTo(DatasetStatus.FROZEN);
            verify(datasetRepository).save(argThat(d -> d.getStatus() == DatasetStatus.FROZEN));
        }

        @Test
        @DisplayName("应该在数据集不存在时抛出异常")
        void shouldRejectNotFound() {
            UUID missingId = UUID.randomUUID();
            when(datasetRepository.findById(missingId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.freeze(tenantId, missingId, userId))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("应该在非 DRAFT 状态冻结时抛出异常")
        void shouldRejectNonDraftFreeze() {
            GoldenDataset ds = new GoldenDataset();
            ds.setId(UUID.randomUUID());
            ds.setTenantId(tenantId);
            ds.setStatus(DatasetStatus.FROZEN);

            when(datasetRepository.findById(ds.getId())).thenReturn(Optional.of(ds));

            assertThatThrownBy(() -> service.freeze(tenantId, ds.getId(), userId))
                    .isInstanceOf(BusinessException.class)
                    .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode()).isEqualTo(ErrorCode.INVALID_DATASET_STATUS));
        }

        @Test
        @DisplayName("应该在跨租户访问时抛 DATASET_NOT_FOUND 异常")
        void shouldRejectCrossTenantFreeze() {
            GoldenDataset ds = new GoldenDataset();
            ds.setId(UUID.randomUUID());
            ds.setTenantId(UUID.randomUUID()); // 不同租户
            ds.setStatus(DatasetStatus.DRAFT);

            when(datasetRepository.findById(ds.getId())).thenReturn(Optional.of(ds));

            assertThatThrownBy(() -> service.freeze(tenantId, ds.getId(), userId))
                    .isInstanceOf(BusinessException.class)
                    .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                            .isEqualTo(ErrorCode.DATASET_NOT_FOUND));
        }

        @Test
        @DisplayName("冻结时应记录 frozenBy 与 frozenAt")
        void shouldRecordFrozenByAndFrozenAt() {
            GoldenDataset ds = new GoldenDataset();
            ds.setId(UUID.randomUUID());
            ds.setTenantId(tenantId);
            ds.setStatus(DatasetStatus.DRAFT);

            when(datasetRepository.findById(ds.getId())).thenReturn(Optional.of(ds));
            when(datasetRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.freeze(tenantId, ds.getId(), userId);

            verify(datasetRepository).save(argThat(d ->
                    d.getStatus() == DatasetStatus.FROZEN
                            && userId.equals(d.getFrozenBy())
                            && d.getFrozenAt() != null
            ));
        }
    }

    // ── 查询数据集 ──

    @Nested
    @DisplayName("查询数据集")
    class ListDataset {

        @Test
        @DisplayName("应该成功查询租户下 FROZEN 状态数据集列表")
        void shouldListFrozenDatasetsByTenant() {
            GoldenDataset ds1 = new GoldenDataset();
            ds1.setId(UUID.randomUUID());
            ds1.setName("办公楼金样-1");
            ds1.setStatus(DatasetStatus.FROZEN);

            GoldenDataset ds2 = new GoldenDataset();
            ds2.setId(UUID.randomUUID());
            ds2.setName("办公楼金样-2");
            ds2.setStatus(DatasetStatus.FROZEN);

            when(datasetRepository.findByTenantIdAndStatus(tenantId, DatasetStatus.FROZEN))
                    .thenReturn(List.of(ds1, ds2));

            List<GoldenDatasetDto> dtos = service.listByTenant(tenantId);

            assertThat(dtos).hasSize(2);
            assertThat(dtos.get(0).name()).isEqualTo("办公楼金样-1");
            assertThat(dtos.get(1).name()).isEqualTo("办公楼金样-2");
        }

        @Test
        @DisplayName("租户下无 FROZEN 数据集时应返回空列表")
        void shouldReturnEmptyListWhenNoFrozenDataset() {
            when(datasetRepository.findByTenantIdAndStatus(tenantId, DatasetStatus.FROZEN))
                    .thenReturn(List.of());

            List<GoldenDatasetDto> dtos = service.listByTenant(tenantId);

            assertThat(dtos).isEmpty();
        }
    }
}
