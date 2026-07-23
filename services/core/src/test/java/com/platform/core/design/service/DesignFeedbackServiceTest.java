package com.platform.core.design.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.design.domain.DesignFeedback;
import com.platform.core.design.domain.DesignOption;
import com.platform.core.design.dto.DesignFeedbackDto;
import com.platform.core.design.dto.DesignFeedbackRequest;
import com.platform.core.design.repository.DesignFeedbackRepository;
import com.platform.core.design.repository.DesignOptionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * DesignFeedbackService 单元测试
 *
 * <p>覆盖核心业务规则：
 * <ul>
 *   <li>提交设计反馈（选项不存在校验、字段映射、审计字段）</li>
 *   <li>查询反馈列表（按选项不存在校验、按创建时间倒序）</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class DesignFeedbackServiceTest {

    @Mock
    private DesignFeedbackRepository feedbackRepository;

    @Mock
    private DesignOptionRepository optionRepository;

    @Captor
    private ArgumentCaptor<DesignFeedback> feedbackCaptor;

    private DesignFeedbackService service;

    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID optionId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final UUID userId = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private final UUID feedbackId = UUID.fromString("44444444-4444-4444-4444-444444444444");

    @BeforeEach
    void setUp() {
        service = new DesignFeedbackService(feedbackRepository, optionRepository);
    }

    @Nested
    @DisplayName("提交设计反馈")
    class SubmitFeedback {

        @Test
        @DisplayName("应该成功提交设计反馈")
        void shouldSubmitFeedback() {
            DesignOption option = new DesignOption();
            option.setId(optionId);
            option.setTenantId(tenantId);

            when(optionRepository.findByIdAndTenantId(optionId, tenantId))
                    .thenReturn(Optional.of(option));
            when(feedbackRepository.save(any(DesignFeedback.class))).thenAnswer(invocation -> {
                DesignFeedback f = invocation.getArgument(0);
                f.setId(feedbackId);
                return f;
            });

            DesignFeedbackRequest request = new DesignFeedbackRequest("方案整体布局合理", 4);

            DesignFeedbackDto dto = service.submit(tenantId, optionId, request, userId);

            assertThat(dto.id()).isEqualTo(feedbackId);
            assertThat(dto.optionId()).isEqualTo(optionId);
            assertThat(dto.authorId()).isEqualTo(userId);
            assertThat(dto.comment()).isEqualTo("方案整体布局合理");
            assertThat(dto.rating()).isEqualTo(4);

            verify(feedbackRepository).save(feedbackCaptor.capture());
            DesignFeedback saved = feedbackCaptor.getValue();
            assertThat(saved.getCreatedBy()).isEqualTo(userId);
            assertThat(saved.getTenantId()).isEqualTo(tenantId);
        }

        @Test
        @DisplayName("应该支持不评分的纯文本反馈")
        void shouldSubmitFeedbackWithoutRating() {
            DesignOption option = new DesignOption();
            option.setId(optionId);
            option.setTenantId(tenantId);

            when(optionRepository.findByIdAndTenantId(optionId, tenantId))
                    .thenReturn(Optional.of(option));
            when(feedbackRepository.save(any(DesignFeedback.class))).thenAnswer(invocation -> {
                DesignFeedback f = invocation.getArgument(0);
                f.setId(feedbackId);
                return f;
            });

            DesignFeedbackRequest request = new DesignFeedbackRequest("仅文本反馈", null);

            DesignFeedbackDto dto = service.submit(tenantId, optionId, request, userId);

            assertThat(dto.rating()).isNull();
            assertThat(dto.comment()).isEqualTo("仅文本反馈");
        }

        @Test
        @DisplayName("应该在设计选项不存在时抛出 NOT_FOUND 异常")
        void shouldThrowWhenOptionNotFound() {
            when(optionRepository.findByIdAndTenantId(optionId, tenantId))
                    .thenReturn(Optional.empty());

            DesignFeedbackRequest request = new DesignFeedbackRequest("评论", 3);

            assertThatThrownBy(() -> service.submit(tenantId, optionId, request, userId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
        }
    }

    @Nested
    @DisplayName("查询反馈列表")
    class ListFeedback {

        @Test
        @DisplayName("应该返回设计选项的反馈列表")
        void shouldReturnFeedbackList() {
            DesignOption option = new DesignOption();
            option.setId(optionId);
            option.setTenantId(tenantId);

            DesignFeedback fb1 = new DesignFeedback();
            fb1.setId(feedbackId);
            fb1.setOptionId(optionId);
            fb1.setAuthorId(userId);
            fb1.setComment("反馈1");
            fb1.setRating(5);

            when(optionRepository.findByIdAndTenantId(optionId, tenantId))
                    .thenReturn(Optional.of(option));
            when(feedbackRepository.findByOptionIdOrderByCreatedAtDesc(optionId))
                    .thenReturn(List.of(fb1));

            List<DesignFeedbackDto> result = service.listByOption(tenantId, optionId);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).comment()).isEqualTo("反馈1");
            assertThat(result.get(0).rating()).isEqualTo(5);
        }

        @Test
        @DisplayName("应该在设计选项不存在时抛出 NOT_FOUND 异常")
        void shouldThrowWhenOptionNotFound() {
            when(optionRepository.findByIdAndTenantId(optionId, tenantId))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.listByOption(tenantId, optionId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
        }

        @Test
        @DisplayName("应该在无反馈时返回空列表")
        void shouldReturnEmptyListWhenNoFeedback() {
            DesignOption option = new DesignOption();
            option.setId(optionId);
            option.setTenantId(tenantId);

            when(optionRepository.findByIdAndTenantId(optionId, tenantId))
                    .thenReturn(Optional.of(option));
            when(feedbackRepository.findByOptionIdOrderByCreatedAtDesc(optionId))
                    .thenReturn(List.of());

            List<DesignFeedbackDto> result = service.listByOption(tenantId, optionId);

            assertThat(result).isEmpty();
        }
    }
}
