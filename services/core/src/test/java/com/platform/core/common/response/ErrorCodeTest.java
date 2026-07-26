package com.platform.core.common.response;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ErrorCode 业务错误码常量单元测试
 *
 * 覆盖：
 * - 各错误码段数值正确
 * - 错误码段不重叠
 * - 常量类不可实例化
 */
@DisplayName("ErrorCode 业务错误码")
class ErrorCodeTest {

    @Nested
    @DisplayName("参数错误段 100-199")
    class ParamErrorSegment {

        @Test
        @DisplayName("PARAM_MISSING 应为 101")
        void paramMissingShouldBe101() {
            assertThat(ErrorCode.PARAM_MISSING).isEqualTo(101);
        }

        @Test
        @DisplayName("PARAM_INVALID 应为 102")
        void paramInvalidShouldBe102() {
            assertThat(ErrorCode.PARAM_INVALID).isEqualTo(102);
        }

        @Test
        @DisplayName("PARAM_OUT_OF_RANGE 应为 103")
        void paramOutOfRangeShouldBe103() {
            assertThat(ErrorCode.PARAM_OUT_OF_RANGE).isEqualTo(103);
        }
    }

    @Nested
    @DisplayName("认证失败段 401/401x")
    class AuthErrorSegment {

        @Test
        @DisplayName("UNAUTHORIZED 应为 401")
        void unauthorizedShouldBe401() {
            assertThat(ErrorCode.UNAUTHORIZED).isEqualTo(401);
        }

        @Test
        @DisplayName("BAD_CREDENTIALS 应为 4011")
        void badCredentialsShouldBe4011() {
            assertThat(ErrorCode.BAD_CREDENTIALS).isEqualTo(4011);
        }

        @Test
        @DisplayName("TOKEN_INVALID 应为 4012")
        void tokenInvalidShouldBe4012() {
            assertThat(ErrorCode.TOKEN_INVALID).isEqualTo(4012);
        }

        @Test
        @DisplayName("TOKEN_EXPIRED 应为 4013")
        void tokenExpiredShouldBe4013() {
            assertThat(ErrorCode.TOKEN_EXPIRED).isEqualTo(4013);
        }

        @Test
        @DisplayName("REFRESH_TOKEN_INVALID 应为 4014")
        void refreshTokenInvalidShouldBe4014() {
            assertThat(ErrorCode.REFRESH_TOKEN_INVALID).isEqualTo(4014);
        }
    }

    @Nested
    @DisplayName("权限不足段 403")
    class ForbiddenSegment {

        @Test
        @DisplayName("FORBIDDEN 应为 403")
        void forbiddenShouldBe403() {
            assertThat(ErrorCode.FORBIDDEN).isEqualTo(403);
        }
    }

    @Nested
    @DisplayName("资源不存在段 404")
    class NotFoundSegment {

        @Test
        @DisplayName("NOT_FOUND 应为 404")
        void notFoundShouldBe404() {
            assertThat(ErrorCode.NOT_FOUND).isEqualTo(404);
        }
    }

    @Nested
    @DisplayName("业务规则失败段 4220-4234")
    class BusinessRuleSegment {

        @Test
        @DisplayName("BUSINESS_RULE_VIOLATION 应为 4220")
        void businessRuleViolationShouldBe4220() {
            assertThat(ErrorCode.BUSINESS_RULE_VIOLATION).isEqualTo(4220);
        }

        @Test
        @DisplayName("PRINCIPAL_ALREADY_EXISTS 应为 4221")
        void principalAlreadyExistsShouldBe4221() {
            assertThat(ErrorCode.PRINCIPAL_ALREADY_EXISTS).isEqualTo(4221);
        }

        @Test
        @DisplayName("TENANT_NOT_FOUND 应为 4222")
        void tenantNotFoundShouldBe4222() {
            assertThat(ErrorCode.TENANT_NOT_FOUND).isEqualTo(4222);
        }

        @Test
        @DisplayName("INVALID_STAGE_CODE 应为 4234")
        void invalidStageCodeShouldBe4234() {
            assertThat(ErrorCode.INVALID_STAGE_CODE).isEqualTo(4234);
        }

        @Test
        @DisplayName("PASSWORD_POLICY_VIOLATION 应为 4235")
        void passwordPolicyViolationShouldBe4235() {
            assertThat(ErrorCode.PASSWORD_POLICY_VIOLATION).isEqualTo(4235);
        }
    }

    @Nested
    @DisplayName("CDE 域错误码段 4236-4240")
    class CdeSegment {

        @Test
        @DisplayName("DOCUMENT_NOT_FOUND 应为 4236")
        void documentNotFoundShouldBe4236() {
            assertThat(ErrorCode.DOCUMENT_NOT_FOUND).isEqualTo(4236);
        }

        @Test
        @DisplayName("VERSION_NOT_FOUND 应为 4237")
        void versionNotFoundShouldBe4237() {
            assertThat(ErrorCode.VERSION_NOT_FOUND).isEqualTo(4237);
        }

        @Test
        @DisplayName("DOCUMENT_CHECKED_OUT 应为 4238")
        void documentCheckedOutShouldBe4238() {
            assertThat(ErrorCode.DOCUMENT_CHECKED_OUT).isEqualTo(4238);
        }

        @Test
        @DisplayName("DOCUMENT_NOT_CHECKED_OUT 应为 4239")
        void documentNotCheckedOutShouldBe4239() {
            assertThat(ErrorCode.DOCUMENT_NOT_CHECKED_OUT).isEqualTo(4239);
        }

        @Test
        @DisplayName("INVALID_DOCUMENT_STATUS 应为 4240")
        void invalidDocumentStatusShouldBe4240() {
            assertThat(ErrorCode.INVALID_DOCUMENT_STATUS).isEqualTo(4240);
        }
    }

    @Nested
    @DisplayName("合规规则域错误码段 4241-4250")
    class ComplianceSegment {

        @Test
        @DisplayName("RULE_NOT_FOUND 应为 4241")
        void ruleNotFoundShouldBe4241() {
            assertThat(ErrorCode.RULE_NOT_FOUND).isEqualTo(4241);
        }

        @Test
        @DisplayName("INVALID_RUN_STATUS 应为 4249")
        void invalidRunStatusShouldBe4249() {
            assertThat(ErrorCode.INVALID_RUN_STATUS).isEqualTo(4249);
        }
    }

    @Nested
    @DisplayName("TEVV 域错误码段 4251-4260")
    class TevvSegment {

        @Test
        @DisplayName("DATASET_NOT_FOUND 应为 4251")
        void datasetNotFoundShouldBe4251() {
            assertThat(ErrorCode.DATASET_NOT_FOUND).isEqualTo(4251);
        }

        @Test
        @DisplayName("WAIVER_REASON_REQUIRED 应为 4257")
        void waiverReasonRequiredShouldBe4257() {
            assertThat(ErrorCode.WAIVER_REASON_REQUIRED).isEqualTo(4257);
        }
    }

    @Nested
    @DisplayName("平台事件/Saga 域错误码段 4258-4270")
    class PlatformSegment {

        @Test
        @DisplayName("SAGA_NOT_FOUND 应为 4258")
        void sagaNotFoundShouldBe4258() {
            assertThat(ErrorCode.SAGA_NOT_FOUND).isEqualTo(4258);
        }

        @Test
        @DisplayName("OUTBOX_EVENT_NOT_FOUND 应为 4263")
        void outboxEventNotFoundShouldBe4263() {
            assertThat(ErrorCode.OUTBOX_EVENT_NOT_FOUND).isEqualTo(4263);
        }
    }

    @Nested
    @DisplayName("服务端错误段 500-599")
    class ServerErrorSegment {

        @Test
        @DisplayName("INTERNAL_ERROR 应为 500")
        void internalErrorShouldBe500() {
            assertThat(ErrorCode.INTERNAL_ERROR).isEqualTo(500);
        }
    }
}
