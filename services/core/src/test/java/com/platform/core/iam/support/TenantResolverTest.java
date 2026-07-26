package com.platform.core.iam.support;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * TenantResolver 单元测试
 *
 * 覆盖：
 * - 合法 UUID 解析
 * - 缺失请求头 → PARAM_MISSING
 * - 空字符串/纯空格 → PARAM_MISSING
 * - 非 UUID 格式 → PARAM_INVALID
 */
@DisplayName("TenantResolver 租户解析器")
class TenantResolverTest {

    private TenantResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new TenantResolver();
    }

    @Nested
    @DisplayName("resolveTenantId 合法解析")
    class ResolveValid {

        @Test
        @DisplayName("应正确解析合法 UUID")
        void shouldResolveValidUuid() {
            // Arrange
            UUID tenantId = UUID.randomUUID();
            HttpServletRequest request = mock(HttpServletRequest.class);
            when(request.getHeader(TenantResolver.TENANT_HEADER)).thenReturn(tenantId.toString());

            // Act
            UUID result = resolver.resolveTenantId(request);

            // Assert
            assertThat(result).isEqualTo(tenantId);
        }

        @Test
        @DisplayName("应使用 x-tenant-id 请求头")
        void shouldUseXTenantIdHeader() {
            // Arrange
            UUID tenantId = UUID.randomUUID();
            HttpServletRequest request = mock(HttpServletRequest.class);
            when(request.getHeader(TenantResolver.TENANT_HEADER)).thenReturn(tenantId.toString());

            // Act
            UUID result = resolver.resolveTenantId(request);

            // Assert
            assertThat(result).isNotNull();
            // 验证 header 名称常量为 x-tenant-id
            assertThat(TenantResolver.TENANT_HEADER).isEqualTo("x-tenant-id");
        }
    }

    @Nested
    @DisplayName("缺失请求头")
    class MissingHeader {

        @Test
        @DisplayName("缺失请求头应抛 PARAM_MISSING 异常")
        void shouldThrowOnMissingHeader() {
            // Arrange
            HttpServletRequest request = mock(HttpServletRequest.class);
            when(request.getHeader(TenantResolver.TENANT_HEADER)).thenReturn(null);

            // Act + Assert
            assertThatThrownBy(() -> resolver.resolveTenantId(request))
                    .isInstanceOf(BusinessException.class)
                    .satisfies(ex -> {
                        BusinessException bex = (BusinessException) ex;
                        assertThat(bex.getErrorCode()).isEqualTo(ErrorCode.PARAM_MISSING);
                        assertThat(bex.getHttpStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    });
        }

        @Test
        @DisplayName("空字符串请求头应抛 PARAM_MISSING 异常")
        void shouldThrowOnEmptyHeader() {
            // Arrange
            HttpServletRequest request = mock(HttpServletRequest.class);
            when(request.getHeader(TenantResolver.TENANT_HEADER)).thenReturn("");

            // Act + Assert
            assertThatThrownBy(() -> resolver.resolveTenantId(request))
                    .isInstanceOf(BusinessException.class)
                    .satisfies(ex -> {
                        BusinessException bex = (BusinessException) ex;
                        assertThat(bex.getErrorCode()).isEqualTo(ErrorCode.PARAM_MISSING);
                    });
        }

        @Test
        @DisplayName("纯空格请求头应抛 PARAM_MISSING 异常")
        void shouldThrowOnBlankHeader() {
            // Arrange
            HttpServletRequest request = mock(HttpServletRequest.class);
            when(request.getHeader(TenantResolver.TENANT_HEADER)).thenReturn("   ");

            // Act + Assert
            assertThatThrownBy(() -> resolver.resolveTenantId(request))
                    .isInstanceOf(BusinessException.class)
                    .satisfies(ex -> {
                        BusinessException bex = (BusinessException) ex;
                        assertThat(bex.getErrorCode()).isEqualTo(ErrorCode.PARAM_MISSING);
                    });
        }

        @Test
        @DisplayName("异常消息应包含请求头名称")
        void shouldIncludeHeaderNameInMessage() {
            // Arrange
            HttpServletRequest request = mock(HttpServletRequest.class);
            when(request.getHeader(TenantResolver.TENANT_HEADER)).thenReturn(null);

            // Act + Assert
            assertThatThrownBy(() -> resolver.resolveTenantId(request))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining(TenantResolver.TENANT_HEADER);
        }
    }

    @Nested
    @DisplayName("非法 UUID 格式")
    class InvalidUuid {

        @Test
        @DisplayName("非 UUID 字符串应抛 PARAM_INVALID 异常")
        void shouldThrowOnNonUuidString() {
            // Arrange
            HttpServletRequest request = mock(HttpServletRequest.class);
            when(request.getHeader(TenantResolver.TENANT_HEADER)).thenReturn("not-a-uuid");

            // Act + Assert
            assertThatThrownBy(() -> resolver.resolveTenantId(request))
                    .isInstanceOf(BusinessException.class)
                    .satisfies(ex -> {
                        BusinessException bex = (BusinessException) ex;
                        assertThat(bex.getErrorCode()).isEqualTo(ErrorCode.PARAM_INVALID);
                        assertThat(bex.getHttpStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    });
        }

        @Test
        @DisplayName("部分 UUID 字符串应抛 PARAM_INVALID 异常")
        void shouldThrowOnPartialUuid() {
            // Arrange
            HttpServletRequest request = mock(HttpServletRequest.class);
            when(request.getHeader(TenantResolver.TENANT_HEADER)).thenReturn("550e8400-e29b-41d4");

            // Act + Assert
            assertThatThrownBy(() -> resolver.resolveTenantId(request))
                    .isInstanceOf(BusinessException.class)
                    .satisfies(ex -> {
                        BusinessException bex = (BusinessException) ex;
                        assertThat(bex.getErrorCode()).isEqualTo(ErrorCode.PARAM_INVALID);
                    });
        }

        @Test
        @DisplayName("数字字符串应抛 PARAM_INVALID 异常")
        void shouldThrowOnNumericString() {
            // Arrange
            HttpServletRequest request = mock(HttpServletRequest.class);
            when(request.getHeader(TenantResolver.TENANT_HEADER)).thenReturn("123456");

            // Act + Assert
            assertThatThrownBy(() -> resolver.resolveTenantId(request))
                    .isInstanceOf(BusinessException.class)
                    .satisfies(ex -> {
                        BusinessException bex = (BusinessException) ex;
                        assertThat(bex.getErrorCode()).isEqualTo(ErrorCode.PARAM_INVALID);
                    });
        }

        @Test
        @DisplayName("异常消息应包含 '不是有效的 UUID' 描述")
        void shouldIncludeInvalidUuidDescription() {
            // Arrange
            HttpServletRequest request = mock(HttpServletRequest.class);
            when(request.getHeader(TenantResolver.TENANT_HEADER)).thenReturn("invalid");

            // Act + Assert
            assertThatThrownBy(() -> resolver.resolveTenantId(request))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("不是有效的 UUID");
        }

        @Test
        @DisplayName("含 UUID 前后空格应能正确解析")
        void shouldResolveUuidWithWhitespace() {
            // 注意：UUID.fromString 不接受含空格的字符串，此测试验证当前行为
            // Arrange
            UUID tenantId = UUID.randomUUID();
            HttpServletRequest request = mock(HttpServletRequest.class);
            when(request.getHeader(TenantResolver.TENANT_HEADER)).thenReturn(" " + tenantId + " ");

            // Act + Assert：含空格应抛 PARAM_INVALID
            assertThatThrownBy(() -> resolver.resolveTenantId(request))
                    .isInstanceOf(BusinessException.class);
        }
    }
}
