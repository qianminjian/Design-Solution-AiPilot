package com.platform.core.portfolio.support;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * StageDefinitions 单元测试
 *
 * 覆盖：
 * - 阶段元数据查询（getStageMeta / requireValidCode）
 * - V0 阶段裁剪集（V0_STAGE_CODES）
 * - 状态机校验（isValidTransition / requireValidTransition）
 * - 终态判断（isTerminal）
 */
@DisplayName("StageDefinitions 阶段定义与状态机")
class StageDefinitionsTest {

    @Nested
    @DisplayName("getStageMeta 阶段元数据查询")
    class GetStageMeta {

        @Test
        @DisplayName("应返回 STG-P0 的元数据")
        void shouldReturnStageP0Meta() {
            // Act
            var meta = StageDefinitions.getStageMeta(StageDefinitions.STG_P0);

            // Assert
            assertThat(meta).isPresent();
            assertThat(meta.get().code()).isEqualTo(StageDefinitions.STG_P0);
            assertThat(meta.get().name()).isEqualTo("前期策划与需求门");
            assertThat(meta.get().order()).isEqualTo(0);
        }

        @Test
        @DisplayName("应返回 STG-P1 的元数据")
        void shouldReturnStageP1Meta() {
            // Act
            var meta = StageDefinitions.getStageMeta(StageDefinitions.STG_P1);

            // Assert
            assertThat(meta).isPresent();
            assertThat(meta.get().code()).isEqualTo(StageDefinitions.STG_P1);
            assertThat(meta.get().name()).isEqualTo("概念设计门");
            assertThat(meta.get().order()).isEqualTo(1);
        }

        @Test
        @DisplayName("应返回 STG-P7 的元数据")
        void shouldReturnStageP7Meta() {
            // Act
            var meta = StageDefinitions.getStageMeta(StageDefinitions.STG_P7);

            // Assert
            assertThat(meta).isPresent();
            assertThat(meta.get().code()).isEqualTo(StageDefinitions.STG_P7);
            assertThat(meta.get().name()).isEqualTo("反馈与变更门");
            assertThat(meta.get().order()).isEqualTo(7);
        }

        @Test
        @DisplayName("非法阶段编码应返回 Optional.empty()")
        void shouldReturnEmptyForInvalidCode() {
            // Act
            var meta = StageDefinitions.getStageMeta("INVALID-CODE");

            // Assert
            assertThat(meta).isEmpty();
        }

        @Test
        @DisplayName("null 阶段编码应返回 Optional.empty()")
        void shouldReturnEmptyForNullCode() {
            // Act
            var meta = StageDefinitions.getStageMeta(null);

            // Assert
            assertThat(meta).isEmpty();
        }

        @Test
        @DisplayName("所有 9 个阶段（P0-P8）应有元数据")
        void shouldHaveAllNineStages() {
            // Act + Assert
            assertThat(StageDefinitions.getStageMeta(StageDefinitions.STG_P0)).isPresent();
            assertThat(StageDefinitions.getStageMeta(StageDefinitions.STG_P1)).isPresent();
            assertThat(StageDefinitions.getStageMeta(StageDefinitions.STG_P2)).isPresent();
            assertThat(StageDefinitions.getStageMeta(StageDefinitions.STG_P3)).isPresent();
            assertThat(StageDefinitions.getStageMeta(StageDefinitions.STG_P4)).isPresent();
            assertThat(StageDefinitions.getStageMeta(StageDefinitions.STG_P5)).isPresent();
            assertThat(StageDefinitions.getStageMeta(StageDefinitions.STG_P6)).isPresent();
            assertThat(StageDefinitions.getStageMeta(StageDefinitions.STG_P7)).isPresent();
            assertThat(StageDefinitions.getStageMeta(StageDefinitions.STG_P8)).isPresent();
        }

        @Test
        @DisplayName("阶段顺序应连续递增（0-8）")
        void shouldHaveSequentialOrder() {
            // Act + Assert
            for (int i = 0; i <= 8; i++) {
                String code = "STG-P" + i;
                var meta = StageDefinitions.getStageMeta(code);
                assertThat(meta).isPresent();
                assertThat(meta.get().order()).isEqualTo(i);
            }
        }
    }

    @Nested
    @DisplayName("requireValidCode 阶段编码合法性校验")
    class RequireValidCode {

        @Test
        @DisplayName("合法编码不应抛异常")
        void shouldNotThrowForValidCode() {
            // Act + Assert：不抛异常即通过
            StageDefinitions.requireValidCode(StageDefinitions.STG_P0);
            StageDefinitions.requireValidCode(StageDefinitions.STG_P1);
            StageDefinitions.requireValidCode(StageDefinitions.STG_P8);
        }

        @Test
        @DisplayName("非法编码应抛 INVALID_STAGE_CODE 异常")
        void shouldThrowForInvalidCode() {
            // Act + Assert
            assertThatThrownBy(() -> StageDefinitions.requireValidCode("INVALID"))
                    .isInstanceOf(BusinessException.class)
                    .satisfies(ex -> {
                        BusinessException bex = (BusinessException) ex;
                        assertThat(bex.getErrorCode()).isEqualTo(ErrorCode.INVALID_STAGE_CODE);
                    });
        }

        @Test
        @DisplayName("null 编码应抛 INVALID_STAGE_CODE 异常")
        void shouldThrowForNullCode() {
            // Act + Assert
            assertThatThrownBy(() -> StageDefinitions.requireValidCode(null))
                    .isInstanceOf(BusinessException.class)
                    .satisfies(ex -> {
                        BusinessException bex = (BusinessException) ex;
                        assertThat(bex.getErrorCode()).isEqualTo(ErrorCode.INVALID_STAGE_CODE);
                    });
        }

        @Test
        @DisplayName("异常消息应包含非法编码")
        void shouldIncludeCodeInMessage() {
            // Act + Assert
            assertThatThrownBy(() -> StageDefinitions.requireValidCode("BAD-CODE"))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("BAD-CODE");
        }
    }

    @Nested
    @DisplayName("V0 阶段裁剪集")
    class V0StageCodes {

        @Test
        @DisplayName("V0 应包含 6 个阶段（P0/P1/P2/P5/P6/P7）")
        void shouldContainSixStages() {
            // Act + Assert
            assertThat(StageDefinitions.V0_STAGE_CODES).hasSize(6);
            assertThat(StageDefinitions.V0_STAGE_CODES).contains(
                    StageDefinitions.STG_P0,
                    StageDefinitions.STG_P1,
                    StageDefinitions.STG_P2,
                    StageDefinitions.STG_P5,
                    StageDefinitions.STG_P6,
                    StageDefinitions.STG_P7);
        }

        @Test
        @DisplayName("V0 不应包含 P3/P4/P8")
        void shouldNotContainP3P4P8() {
            // Act + Assert
            assertThat(StageDefinitions.V0_STAGE_CODES)
                    .doesNotContain(StageDefinitions.STG_P3)
                    .doesNotContain(StageDefinitions.STG_P4)
                    .doesNotContain(StageDefinitions.STG_P8);
        }
    }

    @Nested
    @DisplayName("isValidTransition 状态机校验")
    class IsValidTransition {

        @Test
        @DisplayName("NOT_STARTED → PLANNED 应为合法流转")
        void shouldAllowNotStartedToPlanned() {
            // Act + Assert
            assertThat(StageDefinitions.isValidTransition(
                    StageDefinitions.STATUS_NOT_STARTED, StageDefinitions.STATUS_PLANNED)).isTrue();
        }

        @Test
        @DisplayName("NOT_STARTED → ACTIVE 应为合法流转")
        void shouldAllowNotStartedToActive() {
            // Act + Assert
            assertThat(StageDefinitions.isValidTransition(
                    StageDefinitions.STATUS_NOT_STARTED, StageDefinitions.STATUS_ACTIVE)).isTrue();
        }

        @Test
        @DisplayName("NOT_STARTED → CANCELLED 应为合法流转")
        void shouldAllowNotStartedToCancelled() {
            // Act + Assert
            assertThat(StageDefinitions.isValidTransition(
                    StageDefinitions.STATUS_NOT_STARTED, StageDefinitions.STATUS_CANCELLED)).isTrue();
        }

        @Test
        @DisplayName("PLANNED → ACTIVE 应为合法流转")
        void shouldAllowPlannedToActive() {
            // Act + Assert
            assertThat(StageDefinitions.isValidTransition(
                    StageDefinitions.STATUS_PLANNED, StageDefinitions.STATUS_ACTIVE)).isTrue();
        }

        @Test
        @DisplayName("ACTIVE → REVIEW_PREPARING 应为合法流转")
        void shouldAllowActiveToReviewPreparing() {
            // Act + Assert
            assertThat(StageDefinitions.isValidTransition(
                    StageDefinitions.STATUS_ACTIVE, StageDefinitions.STATUS_REVIEW_PREPARING)).isTrue();
        }

        @Test
        @DisplayName("REVIEW_PREPARING → UNDER_REVIEW 应为合法流转")
        void shouldAllowReviewPreparingToUnderReview() {
            // Act + Assert
            assertThat(StageDefinitions.isValidTransition(
                    StageDefinitions.STATUS_REVIEW_PREPARING, StageDefinitions.STATUS_UNDER_REVIEW)).isTrue();
        }

        @Test
        @DisplayName("UNDER_REVIEW → APPROVED 应为合法流转")
        void shouldAllowUnderReviewToApproved() {
            // Act + Assert
            assertThat(StageDefinitions.isValidTransition(
                    StageDefinitions.STATUS_UNDER_REVIEW, StageDefinitions.STATUS_APPROVED)).isTrue();
        }

        @Test
        @DisplayName("UNDER_REVIEW → CONDITIONALLY_APPROVED 应为合法流转")
        void shouldAllowUnderReviewToConditionallyApproved() {
            // Act + Assert
            assertThat(StageDefinitions.isValidTransition(
                    StageDefinitions.STATUS_UNDER_REVIEW, StageDefinitions.STATUS_CONDITIONALLY_APPROVED)).isTrue();
        }

        @Test
        @DisplayName("APPROVED → CLOSED 应为合法流转")
        void shouldAllowApprovedToClosed() {
            // Act + Assert
            assertThat(StageDefinitions.isValidTransition(
                    StageDefinitions.STATUS_APPROVED, StageDefinitions.STATUS_CLOSED)).isTrue();
        }

        @Test
        @DisplayName("SUSPENDED → ACTIVE 应为合法流转")
        void shouldAllowSuspendedToActive() {
            // Act + Assert
            assertThat(StageDefinitions.isValidTransition(
                    StageDefinitions.STATUS_SUSPENDED, StageDefinitions.STATUS_ACTIVE)).isTrue();
        }

        @Test
        @DisplayName("CLOSED → ACTIVE 应为非法流转（终态）")
        void shouldRejectClosedToActive() {
            // Act + Assert
            assertThat(StageDefinitions.isValidTransition(
                    StageDefinitions.STATUS_CLOSED, StageDefinitions.STATUS_ACTIVE)).isFalse();
        }

        @Test
        @DisplayName("CANCELLED → ACTIVE 应为非法流转（终态）")
        void shouldRejectCancelledToActive() {
            // Act + Assert
            assertThat(StageDefinitions.isValidTransition(
                    StageDefinitions.STATUS_CANCELLED, StageDefinitions.STATUS_ACTIVE)).isFalse();
        }

        @Test
        @DisplayName("NOT_STARTED → CLOSED 应为非法流转")
        void shouldRejectNotStartedToClosed() {
            // Act + Assert
            assertThat(StageDefinitions.isValidTransition(
                    StageDefinitions.STATUS_NOT_STARTED, StageDefinitions.STATUS_CLOSED)).isFalse();
        }

        @Test
        @DisplayName("PLANNED → APPROVED 应为非法流转")
        void shouldRejectPlannedToApproved() {
            // Act + Assert
            assertThat(StageDefinitions.isValidTransition(
                    StageDefinitions.STATUS_PLANNED, StageDefinitions.STATUS_APPROVED)).isFalse();
        }

        @Test
        @DisplayName("未知源状态应返回 false")
        void shouldReturnFalseForUnknownFromStatus() {
            // Act + Assert
            assertThat(StageDefinitions.isValidTransition(
                    "UNKNOWN", StageDefinitions.STATUS_ACTIVE)).isFalse();
        }

        @Test
        @DisplayName("未知目标状态应返回 false")
        void shouldReturnFalseForUnknownToStatus() {
            // Act + Assert
            assertThat(StageDefinitions.isValidTransition(
                    StageDefinitions.STATUS_ACTIVE, "UNKNOWN")).isFalse();
        }
    }

    @Nested
    @DisplayName("requireValidTransition 抛异常版本")
    class RequireValidTransition {

        @Test
        @DisplayName("合法流转不应抛异常")
        void shouldNotThrowForValidTransition() {
            // Act + Assert：不抛异常即通过
            StageDefinitions.requireValidTransition(
                    StageDefinitions.STATUS_NOT_STARTED, StageDefinitions.STATUS_PLANNED);
        }

        @Test
        @DisplayName("非法流转应抛 INVALID_STAGE_TRANSITION 异常")
        void shouldThrowForInvalidTransition() {
            // Act + Assert
            assertThatThrownBy(() -> StageDefinitions.requireValidTransition(
                    StageDefinitions.STATUS_CLOSED, StageDefinitions.STATUS_ACTIVE))
                    .isInstanceOf(BusinessException.class)
                    .satisfies(ex -> {
                        BusinessException bex = (BusinessException) ex;
                        assertThat(bex.getErrorCode()).isEqualTo(ErrorCode.INVALID_STAGE_TRANSITION);
                    });
        }

        @Test
        @DisplayName("异常消息应包含源状态与目标状态")
        void shouldIncludeFromAndToInMessage() {
            // Act + Assert
            assertThatThrownBy(() -> StageDefinitions.requireValidTransition(
                    StageDefinitions.STATUS_PLANNED, StageDefinitions.STATUS_CLOSED))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining(StageDefinitions.STATUS_PLANNED)
                    .hasMessageContaining(StageDefinitions.STATUS_CLOSED);
        }
    }

    @Nested
    @DisplayName("isTerminal 终态判断")
    class IsTerminal {

        @Test
        @DisplayName("CLOSED 应为终态")
        void shouldBeTerminalForClosed() {
            // Act + Assert
            assertThat(StageDefinitions.isTerminal(StageDefinitions.STATUS_CLOSED)).isTrue();
        }

        @Test
        @DisplayName("CANCELLED 应为终态")
        void shouldBeTerminalForCancelled() {
            // Act + Assert
            assertThat(StageDefinitions.isTerminal(StageDefinitions.STATUS_CANCELLED)).isTrue();
        }

        @Test
        @DisplayName("NOT_STARTED 不应为终态")
        void shouldNotBeTerminalForNotStarted() {
            // Act + Assert
            assertThat(StageDefinitions.isTerminal(StageDefinitions.STATUS_NOT_STARTED)).isFalse();
        }

        @Test
        @DisplayName("PLANNED 不应为终态")
        void shouldNotBeTerminalForPlanned() {
            // Act + Assert
            assertThat(StageDefinitions.isTerminal(StageDefinitions.STATUS_PLANNED)).isFalse();
        }

        @Test
        @DisplayName("ACTIVE 不应为终态")
        void shouldNotBeTerminalForActive() {
            // Act + Assert
            assertThat(StageDefinitions.isTerminal(StageDefinitions.STATUS_ACTIVE)).isFalse();
        }

        @Test
        @DisplayName("APPROVED 不应为终态")
        void shouldNotBeTerminalForApproved() {
            // Act + Assert
            assertThat(StageDefinitions.isTerminal(StageDefinitions.STATUS_APPROVED)).isFalse();
        }

        @Test
        @DisplayName("SUSPENDED 不应为终态")
        void shouldNotBeTerminalForSuspended() {
            // Act + Assert
            assertThat(StageDefinitions.isTerminal(StageDefinitions.STATUS_SUSPENDED)).isFalse();
        }

        @Test
        @DisplayName("UNDER_REVIEW 不应为终态")
        void shouldNotBeTerminalForUnderReview() {
            // Act + Assert
            assertThat(StageDefinitions.isTerminal(StageDefinitions.STATUS_UNDER_REVIEW)).isFalse();
        }

        @Test
        @DisplayName("CONDITIONALLY_APPROVED 不应为终态")
        void shouldNotBeTerminalForConditionallyApproved() {
            // Act + Assert
            assertThat(StageDefinitions.isTerminal(StageDefinitions.STATUS_CONDITIONALLY_APPROVED)).isFalse();
        }

        @Test
        @DisplayName("REVIEW_PREPARING 不应为终态")
        void shouldNotBeTerminalForReviewPreparing() {
            // Act + Assert
            assertThat(StageDefinitions.isTerminal(StageDefinitions.STATUS_REVIEW_PREPARING)).isFalse();
        }

        @Test
        @DisplayName("未知状态不应为终态")
        void shouldNotBeTerminalForUnknownStatus() {
            // Act + Assert
            assertThat(StageDefinitions.isTerminal("UNKNOWN")).isFalse();
        }
    }
}
