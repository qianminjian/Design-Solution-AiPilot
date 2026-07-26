package com.platform.core.auth.util;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * CookieUtil 单元测试
 *
 * 覆盖：
 * - 设置 refresh token cookie（HttpOnly/SameSite=Strict/Path）
 * - 清除 refresh token cookie
 * - 从请求中读取 refresh token
 * - dev / prod 环境下 Secure 标志差异
 */
@DisplayName("CookieUtil Cookie 工具")
class CookieUtilTest {

    private CookieUtil cookieUtil;

    @BeforeEach
    void setUp() {
        cookieUtil = new CookieUtil();
        // 默认 dev profile
        System.setProperty("spring.profiles.active", "default");
    }

    @AfterEach
    void tearDown() {
        System.clearProperty("spring.profiles.active");
    }

    @Nested
    @DisplayName("setRefreshTokenCookie 设置 cookie")
    class SetRefreshTokenCookie {

        @Test
        @DisplayName("应包含 refresh_token 字段名")
        void shouldIncludeCookieName() {
            // Arrange
            MockHttpServletResponse response = new MockHttpServletResponse();

            // Act
            cookieUtil.setRefreshTokenCookie(response, "token-value", 3600);

            // Assert
            String setCookie = response.getHeader("Set-Cookie");
            assertThat(setCookie).startsWith(CookieUtil.REFRESH_TOKEN_COOKIE + "=");
        }

        @Test
        @DisplayName("应包含 token 值")
        void shouldIncludeTokenValue() {
            // Arrange
            MockHttpServletResponse response = new MockHttpServletResponse();

            // Act
            cookieUtil.setRefreshTokenCookie(response, "my-secret-token", 3600);

            // Assert
            String setCookie = response.getHeader("Set-Cookie");
            assertThat(setCookie).contains("my-secret-token");
        }

        @Test
        @DisplayName("应包含 Path=/api/v1/auth")
        void shouldIncludePath() {
            // Arrange
            MockHttpServletResponse response = new MockHttpServletResponse();

            // Act
            cookieUtil.setRefreshTokenCookie(response, "token", 3600);

            // Assert
            String setCookie = response.getHeader("Set-Cookie");
            assertThat(setCookie).contains("Path=/api/v1/auth");
        }

        @Test
        @DisplayName("应包含 Max-Age")
        void shouldIncludeMaxAge() {
            // Arrange
            MockHttpServletResponse response = new MockHttpServletResponse();

            // Act
            cookieUtil.setRefreshTokenCookie(response, "token", 7200);

            // Assert
            String setCookie = response.getHeader("Set-Cookie");
            assertThat(setCookie).contains("Max-Age=7200");
        }

        @Test
        @DisplayName("应包含 HttpOnly 标志")
        void shouldIncludeHttpOnly() {
            // Arrange
            MockHttpServletResponse response = new MockHttpServletResponse();

            // Act
            cookieUtil.setRefreshTokenCookie(response, "token", 3600);

            // Assert
            String setCookie = response.getHeader("Set-Cookie");
            assertThat(setCookie).contains("HttpOnly");
        }

        @Test
        @DisplayName("应包含 SameSite=Strict")
        void shouldIncludeSameSiteStrict() {
            // Arrange
            MockHttpServletResponse response = new MockHttpServletResponse();

            // Act
            cookieUtil.setRefreshTokenCookie(response, "token", 3600);

            // Assert
            String setCookie = response.getHeader("Set-Cookie");
            assertThat(setCookie).contains("SameSite=Strict");
        }

        @Test
        @DisplayName("dev 环境不应包含 Secure 标志")
        void shouldNotIncludeSecureInDev() {
            // Arrange
            MockHttpServletResponse response = new MockHttpServletResponse();
            System.setProperty("spring.profiles.active", "dev");

            // Act
            cookieUtil.setRefreshTokenCookie(response, "token", 3600);

            // Assert
            String setCookie = response.getHeader("Set-Cookie");
            assertThat(setCookie).doesNotContain("Secure");
        }

        @Test
        @DisplayName("default 环境不应包含 Secure 标志")
        void shouldNotIncludeSecureInDefaultProfile() {
            // Arrange
            MockHttpServletResponse response = new MockHttpServletResponse();
            System.setProperty("spring.profiles.active", "default");

            // Act
            cookieUtil.setRefreshTokenCookie(response, "token", 3600);

            // Assert
            String setCookie = response.getHeader("Set-Cookie");
            assertThat(setCookie).doesNotContain("Secure");
        }

        @Test
        @DisplayName("prod 环境应包含 Secure 标志")
        void shouldIncludeSecureInProd() {
            // Arrange
            MockHttpServletResponse response = new MockHttpServletResponse();
            System.setProperty("spring.profiles.active", "prod");

            // Act
            cookieUtil.setRefreshTokenCookie(response, "token", 3600);

            // Assert
            String setCookie = response.getHeader("Set-Cookie");
            assertThat(setCookie).contains("Secure");
        }

        @Test
        @DisplayName("production 环境应包含 Secure 标志")
        void shouldIncludeSecureInProduction() {
            // Arrange
            MockHttpServletResponse response = new MockHttpServletResponse();
            System.setProperty("spring.profiles.active", "production");

            // Act
            cookieUtil.setRefreshTokenCookie(response, "token", 3600);

            // Assert
            String setCookie = response.getHeader("Set-Cookie");
            assertThat(setCookie).contains("Secure");
        }

        @Test
        @DisplayName("Max-Age 为 0 应正确写入")
        void shouldHandleZeroMaxAge() {
            // Arrange
            MockHttpServletResponse response = new MockHttpServletResponse();

            // Act
            cookieUtil.setRefreshTokenCookie(response, "token", 0);

            // Assert
            String setCookie = response.getHeader("Set-Cookie");
            assertThat(setCookie).contains("Max-Age=0");
        }

        @Test
        @DisplayName("token 为空字符串应正常写入")
        void shouldHandleEmptyToken() {
            // Arrange
            MockHttpServletResponse response = new MockHttpServletResponse();

            // Act
            cookieUtil.setRefreshTokenCookie(response, "", 3600);

            // Assert
            String setCookie = response.getHeader("Set-Cookie");
            assertThat(setCookie).startsWith(CookieUtil.REFRESH_TOKEN_COOKIE + "=;");
        }
    }

    @Nested
    @DisplayName("clearRefreshTokenCookie 清除 cookie")
    class ClearRefreshTokenCookie {

        @Test
        @DisplayName("应设置 Max-Age=0")
        void shouldSetMaxAgeZero() {
            // Arrange
            MockHttpServletResponse response = new MockHttpServletResponse();

            // Act
            cookieUtil.clearRefreshTokenCookie(response);

            // Assert
            String setCookie = response.getHeader("Set-Cookie");
            assertThat(setCookie).contains("Max-Age=0");
        }

        @Test
        @DisplayName("应清空 token 值")
        void shouldClearTokenValue() {
            // Arrange
            MockHttpServletResponse response = new MockHttpServletResponse();

            // Act
            cookieUtil.clearRefreshTokenCookie(response);

            // Assert
            String setCookie = response.getHeader("Set-Cookie");
            // refresh_token=; 后面应是分号
            assertThat(setCookie).startsWith(CookieUtil.REFRESH_TOKEN_COOKIE + "=;");
        }

        @Test
        @DisplayName("应包含 HttpOnly 与 SameSite=Strict")
        void shouldIncludeSecurityFlags() {
            // Arrange
            MockHttpServletResponse response = new MockHttpServletResponse();

            // Act
            cookieUtil.clearRefreshTokenCookie(response);

            // Assert
            String setCookie = response.getHeader("Set-Cookie");
            assertThat(setCookie).contains("HttpOnly").contains("SameSite=Strict");
        }

        @Test
        @DisplayName("应包含 Path=/api/v1/auth")
        void shouldIncludePath() {
            // Arrange
            MockHttpServletResponse response = new MockHttpServletResponse();

            // Act
            cookieUtil.clearRefreshTokenCookie(response);

            // Assert
            String setCookie = response.getHeader("Set-Cookie");
            assertThat(setCookie).contains("Path=/api/v1/auth");
        }

        @Test
        @DisplayName("prod 环境应包含 Secure 标志")
        void shouldIncludeSecureInProd() {
            // Arrange
            MockHttpServletResponse response = new MockHttpServletResponse();
            System.setProperty("spring.profiles.active", "prod");

            // Act
            cookieUtil.clearRefreshTokenCookie(response);

            // Assert
            String setCookie = response.getHeader("Set-Cookie");
            assertThat(setCookie).contains("Secure");
        }

        @Test
        @DisplayName("dev 环境不应包含 Secure 标志")
        void shouldNotIncludeSecureInDev() {
            // Arrange
            MockHttpServletResponse response = new MockHttpServletResponse();

            // Act
            cookieUtil.clearRefreshTokenCookie(response);

            // Assert
            String setCookie = response.getHeader("Set-Cookie");
            assertThat(setCookie).doesNotContain("Secure");
        }
    }

    @Nested
    @DisplayName("getRefreshTokenFromCookie 读取 cookie")
    class GetRefreshTokenFromCookie {

        @Test
        @DisplayName("应从合法 cookie 中读取 token")
        void shouldReadTokenFromValidCookie() {
            // Arrange
            HttpServletRequest request = mock(HttpServletRequest.class);
            Cookie cookie = new Cookie(CookieUtil.REFRESH_TOKEN_COOKIE, "stored-token-value");
            when(request.getCookies()).thenReturn(new Cookie[]{cookie});

            // Act
            String token = cookieUtil.getRefreshTokenFromCookie(request);

            // Assert
            assertThat(token).isEqualTo("stored-token-value");
        }

        @Test
        @DisplayName("无 cookies 时应返回 null")
        void shouldReturnNullWhenNoCookies() {
            // Arrange
            HttpServletRequest request = mock(HttpServletRequest.class);
            when(request.getCookies()).thenReturn(null);

            // Act
            String token = cookieUtil.getRefreshTokenFromCookie(request);

            // Assert
            assertThat(token).isNull();
        }

        @Test
        @DisplayName("无 refresh_token cookie 时应返回 null")
        void shouldReturnNullWhenNoRefreshTokenCookie() {
            // Arrange
            HttpServletRequest request = mock(HttpServletRequest.class);
            Cookie otherCookie = new Cookie("other_cookie", "other-value");
            when(request.getCookies()).thenReturn(new Cookie[]{otherCookie});

            // Act
            String token = cookieUtil.getRefreshTokenFromCookie(request);

            // Assert
            assertThat(token).isNull();
        }

        @Test
        @DisplayName("多个 cookie 中应正确匹配 refresh_token")
        void shouldMatchRefreshTokenAmongMultipleCookies() {
            // Arrange
            HttpServletRequest request = mock(HttpServletRequest.class);
            Cookie cookie1 = new Cookie("session", "session-value");
            Cookie cookie2 = new Cookie(CookieUtil.REFRESH_TOKEN_COOKIE, "refresh-value");
            Cookie cookie3 = new Cookie("preferences", "dark-mode");
            when(request.getCookies()).thenReturn(new Cookie[]{cookie1, cookie2, cookie3});

            // Act
            String token = cookieUtil.getRefreshTokenFromCookie(request);

            // Assert
            assertThat(token).isEqualTo("refresh-value");
        }

        @Test
        @DisplayName("空 cookies 数组应返回 null")
        void shouldReturnNullForEmptyCookieArray() {
            // Arrange
            HttpServletRequest request = mock(HttpServletRequest.class);
            when(request.getCookies()).thenReturn(new Cookie[]{});

            // Act
            String token = cookieUtil.getRefreshTokenFromCookie(request);

            // Assert
            assertThat(token).isNull();
        }

        @Test
        @DisplayName("refresh_token 值为空字符串时应返回空字符串")
        void shouldReturnEmptyStringForEmptyValue() {
            // Arrange
            HttpServletRequest request = mock(HttpServletRequest.class);
            Cookie cookie = new Cookie(CookieUtil.REFRESH_TOKEN_COOKIE, "");
            when(request.getCookies()).thenReturn(new Cookie[]{cookie});

            // Act
            String token = cookieUtil.getRefreshTokenFromCookie(request);

            // Assert
            assertThat(token).isEmpty();
        }
    }
}
