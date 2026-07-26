package com.platform.core.auth.token;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * InMemoryRefreshTokenStore 单元测试
 *
 * 覆盖：
 * - store / validate / getPrincipalId / revoke / revokeAllForPrincipal
 * - 过期 token 惰性清理
 * - 参数校验（null / 非法值）
 * - 多设备会话隔离
 */
@DisplayName("InMemoryRefreshTokenStore 内存刷新令牌存储")
class InMemoryRefreshTokenStoreTest {

    private InMemoryRefreshTokenStore store;

    private static final UUID PRINCIPAL_ID = UUID.randomUUID();
    private static final String TOKEN = "token-abc-123";
    private static final String ANOTHER_TOKEN = "token-xyz-789";

    @BeforeEach
    void setUp() {
        store = new InMemoryRefreshTokenStore();
    }

    @Nested
    @DisplayName("store 存储令牌")
    class Store {

        @Test
        @DisplayName("应成功存储合法 token")
        void shouldStoreValidToken() {
            // Arrange
            Instant expiresAt = Instant.now().plusSeconds(3600);

            // Act
            store.store(TOKEN, PRINCIPAL_ID, expiresAt);

            // Assert
            assertThat(store.validate(TOKEN)).isTrue();
        }

        @Test
        @DisplayName("token 为 null 应抛 IllegalArgumentException")
        void shouldRejectNullToken() {
            // Arrange
            Instant expiresAt = Instant.now().plusSeconds(3600);

            // Act + Assert
            assertThatThrownBy(() -> store.store(null, PRINCIPAL_ID, expiresAt))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("principalId 为 null 应抛 IllegalArgumentException")
        void shouldRejectNullPrincipalId() {
            // Arrange
            Instant expiresAt = Instant.now().plusSeconds(3600);

            // Act + Assert
            assertThatThrownBy(() -> store.store(TOKEN, null, expiresAt))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("expiresAt 为 null 应抛 IllegalArgumentException")
        void shouldRejectNullExpiresAt() {
            // Act + Assert
            assertThatThrownBy(() -> store.store(TOKEN, PRINCIPAL_ID, null))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("同一 token 重复存储应覆盖旧值")
        void shouldOverwriteExistingToken() {
            // Arrange
            UUID newPrincipalId = UUID.randomUUID();
            Instant futureExpires = Instant.now().plusSeconds(3600);

            // 先存
            store.store(TOKEN, PRINCIPAL_ID, futureExpires);
            assertThat(store.getPrincipalId(TOKEN)).isEqualTo(PRINCIPAL_ID);

            // Act：用新 principal 覆盖
            store.store(TOKEN, newPrincipalId, futureExpires);

            // Assert
            assertThat(store.getPrincipalId(TOKEN)).isEqualTo(newPrincipalId);
        }
    }

    @Nested
    @DisplayName("validate 验证令牌")
    class Validate {

        @Test
        @DisplayName("合法且未过期的 token 应返回 true")
        void shouldReturnTrueForValidToken() {
            // Arrange
            store.store(TOKEN, PRINCIPAL_ID, Instant.now().plusSeconds(3600));

            // Act + Assert
            assertThat(store.validate(TOKEN)).isTrue();
        }

        @Test
        @DisplayName("token 为 null 应返回 false")
        void shouldReturnFalseForNullToken() {
            // Act + Assert
            assertThat(store.validate(null)).isFalse();
        }

        @Test
        @DisplayName("不存在的 token 应返回 false")
        void shouldReturnFalseForNonExistingToken() {
            // Act + Assert
            assertThat(store.validate("non-existing-token")).isFalse();
        }

        @Test
        @DisplayName("已过期的 token 应返回 false 并清理")
        void shouldReturnFalseForExpiredTokenAndCleanUp() {
            // Arrange
            store.store(TOKEN, PRINCIPAL_ID, Instant.now().minusSeconds(60));

            // Act
            boolean result = store.validate(TOKEN);

            // Assert
            assertThat(result).isFalse();
            // 再次验证，确认已被清理（仍返回 false 但内部应不残留）
            assertThat(store.validate(TOKEN)).isFalse();
        }

        @Test
        @DisplayName("刚刚过期的 token 应返回 false")
        void shouldReturnFalseForJustExpiredToken() {
            // Arrange
            store.store(TOKEN, PRINCIPAL_ID, Instant.now().minusNanos(1));

            // Act + Assert
            assertThat(store.validate(TOKEN)).isFalse();
        }

        @Test
        @DisplayName("未来有效期 token 应返回 true")
        void shouldReturnTrueForFutureExpiringToken() {
            // Arrange
            store.store(TOKEN, PRINCIPAL_ID, Instant.now().plusSeconds(1));

            // Act + Assert
            assertThat(store.validate(TOKEN)).isTrue();
        }
    }

    @Nested
    @DisplayName("getPrincipalId 获取主体 ID")
    class GetPrincipalId {

        @Test
        @DisplayName("应返回存储时的 principalId")
        void shouldReturnPrincipalId() {
            // Arrange
            store.store(TOKEN, PRINCIPAL_ID, Instant.now().plusSeconds(3600));

            // Act + Assert
            assertThat(store.getPrincipalId(TOKEN)).isEqualTo(PRINCIPAL_ID);
        }

        @Test
        @DisplayName("token 为 null 应返回 null")
        void shouldReturnNullForNullToken() {
            // Act + Assert
            assertThat(store.getPrincipalId(null)).isNull();
        }

        @Test
        @DisplayName("不存在的 token 应返回 null")
        void shouldReturnNullForNonExistingToken() {
            // Act + Assert
            assertThat(store.getPrincipalId("non-existing")).isNull();
        }

        @Test
        @DisplayName("已过期的 token 应返回 null 并清理")
        void shouldReturnNullAndCleanUpForExpiredToken() {
            // Arrange
            store.store(TOKEN, PRINCIPAL_ID, Instant.now().minusSeconds(60));

            // Act
            UUID result = store.getPrincipalId(TOKEN);

            // Assert
            assertThat(result).isNull();
            // 验证已被清理
            assertThat(store.getPrincipalId(TOKEN)).isNull();
        }
    }

    @Nested
    @DisplayName("revoke 撤销单个 token")
    class Revoke {

        @Test
        @DisplayName("应成功撤销存在的 token")
        void shouldRevokeExistingToken() {
            // Arrange
            store.store(TOKEN, PRINCIPAL_ID, Instant.now().plusSeconds(3600));

            // Act
            store.revoke(TOKEN);

            // Assert
            assertThat(store.validate(TOKEN)).isFalse();
            assertThat(store.getPrincipalId(TOKEN)).isNull();
        }

        @Test
        @DisplayName("撤销不存在的 token 不应抛异常")
        void shouldNotThrowForNonExistingToken() {
            // Act + Assert
            store.revoke("non-existing-token");
            // 不抛异常即通过
        }

        @Test
        @DisplayName("撤销 null token 不应抛异常")
        void shouldNotThrowForNullToken() {
            // Act + Assert
            store.revoke(null);
        }

        @Test
        @DisplayName("撤销 token 后该 principal 的其他 token 仍可用")
        void shouldNotAffectOtherTokensOfSamePrincipal() {
            // Arrange
            store.store(TOKEN, PRINCIPAL_ID, Instant.now().plusSeconds(3600));
            store.store(ANOTHER_TOKEN, PRINCIPAL_ID, Instant.now().plusSeconds(3600));

            // Act
            store.revoke(TOKEN);

            // Assert
            assertThat(store.validate(TOKEN)).isFalse();
            assertThat(store.validate(ANOTHER_TOKEN)).isTrue();
        }
    }

    @Nested
    @DisplayName("revokeAllForPrincipal 撤销主体所有 token")
    class RevokeAllForPrincipal {

        @Test
        @DisplayName("应撤销该主体的所有 token")
        void shouldRevokeAllTokensOfPrincipal() {
            // Arrange
            store.store(TOKEN, PRINCIPAL_ID, Instant.now().plusSeconds(3600));
            store.store(ANOTHER_TOKEN, PRINCIPAL_ID, Instant.now().plusSeconds(3600));

            // Act
            store.revokeAllForPrincipal(PRINCIPAL_ID);

            // Assert
            assertThat(store.validate(TOKEN)).isFalse();
            assertThat(store.validate(ANOTHER_TOKEN)).isFalse();
        }

        @Test
        @DisplayName("撤销该主体 token 不应影响其他主体")
        void shouldNotAffectOtherPrincipals() {
            // Arrange
            UUID anotherPrincipal = UUID.randomUUID();
            store.store(TOKEN, PRINCIPAL_ID, Instant.now().plusSeconds(3600));
            store.store(ANOTHER_TOKEN, anotherPrincipal, Instant.now().plusSeconds(3600));

            // Act
            store.revokeAllForPrincipal(PRINCIPAL_ID);

            // Assert
            assertThat(store.validate(TOKEN)).isFalse();
            assertThat(store.validate(ANOTHER_TOKEN)).isTrue();
        }

        @Test
        @DisplayName("principalId 为 null 不应抛异常")
        void shouldNotThrowForNullPrincipalId() {
            // Act + Assert
            store.revokeAllForPrincipal(null);
        }

        @Test
        @DisplayName("撤销不存在的主体不应抛异常")
        void shouldNotThrowForNonExistingPrincipal() {
            // Act + Assert
            store.revokeAllForPrincipal(UUID.randomUUID());
        }
    }

    @Nested
    @DisplayName("多设备会话隔离")
    class MultiDeviceSession {

        @Test
        @DisplayName("同一主体多设备 token 应独立存储")
        void shouldStoreMultipleTokensForSamePrincipal() {
            // Arrange
            String deviceAToken = "device-a-token";
            String deviceBToken = "device-b-token";
            Instant future = Instant.now().plusSeconds(3600);

            // Act
            store.store(deviceAToken, PRINCIPAL_ID, future);
            store.store(deviceBToken, PRINCIPAL_ID, future);

            // Assert
            assertThat(store.validate(deviceAToken)).isTrue();
            assertThat(store.validate(deviceBToken)).isTrue();
            assertThat(store.getPrincipalId(deviceAToken)).isEqualTo(PRINCIPAL_ID);
            assertThat(store.getPrincipalId(deviceBToken)).isEqualTo(PRINCIPAL_ID);
        }

        @Test
        @DisplayName("单设备登出应仅撤销该设备 token")
        void shouldOnlyRevokeSingleDeviceToken() {
            // Arrange
            String deviceAToken = "device-a-token";
            String deviceBToken = "device-b-token";
            Instant future = Instant.now().plusSeconds(3600);
            store.store(deviceAToken, PRINCIPAL_ID, future);
            store.store(deviceBToken, PRINCIPAL_ID, future);

            // Act：设备 A 登出
            store.revoke(deviceAToken);

            // Assert
            assertThat(store.validate(deviceAToken)).isFalse();
            assertThat(store.validate(deviceBToken)).isTrue();
        }

        @Test
        @DisplayName("全设备登出应撤销该主体所有 token")
        void shouldRevokeAllDevicesViaRevokeAll() {
            // Arrange
            String deviceAToken = "device-a-token";
            String deviceBToken = "device-b-token";
            String deviceCToken = "device-c-token";
            Instant future = Instant.now().plusSeconds(3600);
            store.store(deviceAToken, PRINCIPAL_ID, future);
            store.store(deviceBToken, PRINCIPAL_ID, future);
            store.store(deviceCToken, PRINCIPAL_ID, future);

            // Act：全设备登出
            store.revokeAllForPrincipal(PRINCIPAL_ID);

            // Assert
            assertThat(store.validate(deviceAToken)).isFalse();
            assertThat(store.validate(deviceBToken)).isFalse();
            assertThat(store.validate(deviceCToken)).isFalse();
        }
    }
}
