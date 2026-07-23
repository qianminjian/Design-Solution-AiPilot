package com.platform.core.design.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.design.domain.DesignDiscipline;
import com.platform.core.design.domain.DesignOption;
import com.platform.core.design.domain.DesignOptionStatus;
import com.platform.core.design.dto.CreateDesignOptionRequest;
import com.platform.core.design.dto.DesignOptionDto;
import com.platform.core.design.repository.DesignOptionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * DesignOptionService 单元测试
 *
 * <p>覆盖核心业务规则：
 * <ul>
 *   <li>创建设计选项（默认值、字段映射、审计字段）</li>
 *   <li>分页查询设计选项（状态/专业过滤）</li>
 *   <li>查询设计选项详情（不存在异常）</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class DesignOptionServiceTest {

    @Mock
    private DesignOptionRepository optionRepository;

    @Captor
    private ArgumentCaptor<DesignOption> optionCaptor;

    private DesignOptionService service;

    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID projectId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final UUID userId = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private final UUID optionId = UUID.fromString("44444444-4444-4444-4444-444444444444");

    @BeforeEach
    void setUp() {
        service = new DesignOptionService(optionRepository, new ObjectMapper());
    }

    @Nested
    @DisplayName("创建设计选项")
    class CreateOption {

        @Test
        @DisplayName("应该成功创建设计选项并设置默认值")
        void shouldCreateOptionWithDefaults() {
            when(optionRepository.save(any(DesignOption.class))).thenAnswer(invocation -> {
                DesignOption d = invocation.getArgument(0);
                d.setId(optionId);
                return d;
            });

            CreateDesignOptionRequest request = new CreateDesignOptionRequest(
                    projectId, "方案A-围合式中庭", "围合布局", null, null, null);

            DesignOptionDto dto = service.create(tenantId, request, userId);

            assertThat(dto.id()).isEqualTo(optionId);
            assertThat(dto.tenantId()).isEqualTo(tenantId);
            assertThat(dto.projectId()).isEqualTo(projectId);
            assertThat(dto.title()).isEqualTo("方案A-围合式中庭");
            assertThat(dto.status()).isEqualTo(DesignOptionStatus.DRAFT);
            // 未指定专业时默认建筑
            assertThat(dto.discipline()).isEqualTo(DesignDiscipline.ARCHITECTURE);

            verify(optionRepository).save(optionCaptor.capture());
            DesignOption saved = optionCaptor.getValue();
            assertThat(saved.getCreatedBy()).isEqualTo(userId);
            assertThat(saved.getUpdatedBy()).isEqualTo(userId);
        }

        @Test
        @DisplayName("应该使用指定的专业创建设计选项")
        void shouldCreateOptionWithSpecifiedDiscipline() {
            when(optionRepository.save(any(DesignOption.class))).thenAnswer(invocation -> {
                DesignOption d = invocation.getArgument(0);
                d.setId(optionId);
                return d;
            });

            CreateDesignOptionRequest request = new CreateDesignOptionRequest(
                    projectId, "结构方案", null, DesignDiscipline.STRUCTURE, null, null);

            DesignOptionDto dto = service.create(tenantId, request, userId);

            assertThat(dto.discipline()).isEqualTo(DesignDiscipline.STRUCTURE);
        }

        @Test
        @DisplayName("应该携带 metadata 和缩略图文档 ID")
        void shouldCarryMetadataAndThumbnail() {
            when(optionRepository.save(any(DesignOption.class))).thenAnswer(invocation -> {
                DesignOption d = invocation.getArgument(0);
                d.setId(optionId);
                return d;
            });

            UUID thumbDocId = UUID.fromString("55555555-5555-5555-5555-555555555555");
            CreateDesignOptionRequest request = new CreateDesignOptionRequest(
                    projectId, "方案B", "描述", DesignDiscipline.MEP, "{\"area\":1200}", thumbDocId);

            DesignOptionDto dto = service.create(tenantId, request, userId);

            assertThat(dto.thumbnailDocumentId()).isEqualTo(thumbDocId);
            assertThat(dto.metadata()).contains("area");
        }
    }

    @Nested
    @DisplayName("查询设计选项")
    class QueryOption {

        @Test
        @DisplayName("应该返回设计选项详情")
        void shouldReturnOptionDetail() {
            DesignOption option = new DesignOption();
            option.setId(optionId);
            option.setTenantId(tenantId);
            option.setProjectId(projectId);
            option.setTitle("方案A");
            option.setStatus(DesignOptionStatus.CANDIDATE);

            when(optionRepository.findByIdAndTenantId(optionId, tenantId))
                    .thenReturn(Optional.of(option));

            DesignOptionDto dto = service.get(tenantId, optionId);

            assertThat(dto.id()).isEqualTo(optionId);
            assertThat(dto.title()).isEqualTo("方案A");
            assertThat(dto.status()).isEqualTo(DesignOptionStatus.CANDIDATE);
        }

        @Test
        @DisplayName("应该在设计选项不存在时抛出 NOT_FOUND 异常")
        void shouldThrowWhenOptionNotFound() {
            when(optionRepository.findByIdAndTenantId(optionId, tenantId))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.get(tenantId, optionId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
        }

        @Test
        @DisplayName("应该支持按状态和专业过滤分页查询")
        void shouldSupportPagedQueryWithFilters() {
            DesignOption option = new DesignOption();
            option.setId(optionId);
            option.setTenantId(tenantId);
            option.setProjectId(projectId);
            option.setTitle("方案A");
            option.setStatus(DesignOptionStatus.SUBMITTED);
            option.setDiscipline(DesignDiscipline.ARCHITECTURE);

            Pageable pageable = PageRequest.of(0, 10);
            Page<DesignOption> page = new PageImpl<>(List.of(option), pageable, 1);

            when(optionRepository.findByTenantIdAndProjectId(
                    tenantId, projectId, DesignOptionStatus.SUBMITTED, DesignDiscipline.ARCHITECTURE, pageable))
                    .thenReturn(page);

            Page<DesignOptionDto> result = service.list(
                    tenantId, projectId,
                    DesignOptionStatus.SUBMITTED, DesignDiscipline.ARCHITECTURE,
                    1, 10);

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getTotalElements()).isEqualTo(1);
            assertThat(result.getContent().get(0).title()).isEqualTo("方案A");
        }

        @Test
        @DisplayName("应该支持无过滤条件分页查询")
        void shouldSupportPagedQueryWithoutFilters() {
            DesignOption option = new DesignOption();
            option.setId(optionId);
            option.setTenantId(tenantId);
            option.setProjectId(projectId);
            option.setTitle("方案A");

            Pageable pageable = PageRequest.of(0, 10);
            Page<DesignOption> page = new PageImpl<>(List.of(option), pageable, 1);

            when(optionRepository.findByTenantIdAndProjectId(
                    tenantId, projectId, null, null, pageable))
                    .thenReturn(page);

            Page<DesignOptionDto> result = service.list(
                    tenantId, projectId, null, null, 1, 10);

            assertThat(result.getContent()).hasSize(1);
        }

        @Test
        @DisplayName("应该将页码从 1 起转换为 0 起的 Pageable")
        void shouldConvertPageNumberFromOneBasedToZeroBased() {
            Pageable pageable = PageRequest.of(0, 20);
            Page<DesignOption> emptyPage = new PageImpl<>(List.of(), pageable, 0);

            when(optionRepository.findByTenantIdAndProjectId(
                    tenantId, projectId, null, null, pageable))
                    .thenReturn(emptyPage);

            service.list(tenantId, projectId, null, null, 1, 20);

            // 验证 Pageable 为 0 起
            verify(optionRepository).findByTenantIdAndProjectId(
                    tenantId, projectId, null, null, PageRequest.of(0, 20));
        }
    }
}
