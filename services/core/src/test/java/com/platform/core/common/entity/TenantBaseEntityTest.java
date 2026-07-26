package com.platform.core.common.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * TenantBaseEntity 单元测试
 *
 * 覆盖：
 * - tenantId 字段
 * - 继承自 BaseEntity 的字段
 */
@DisplayName("TenantBaseEntity 租户级基础实体")
class TenantBaseEntityTest {

    @Nested
    @DisplayName("tenantId 字段")
    class TenantIdField {

        @Test
        @DisplayName("默认值为 null")
        void shouldBeNullByDefault() {
            TestTenantEntity entity = new TestTenantEntity();
            assertThat(entity.getTenantId()).isNull();
        }

        @Test
        @DisplayName("应允许设置并读取 UUID 值")
        void shouldSetAndGetUuid() {
            TestTenantEntity entity = new TestTenantEntity();
            UUID tenantId = UUID.randomUUID();

            entity.setTenantId(tenantId);

            assertThat(entity.getTenantId()).isEqualTo(tenantId);
        }
    }

    @Nested
    @DisplayName("继承自 BaseEntity 的字段")
    class InheritedFields {

        @Test
        @DisplayName("应继承 createdAt 字段")
        void shouldInheritCreatedAt() {
            TestTenantEntity entity = new TestTenantEntity();
            Instant now = Instant.now();

            entity.setCreatedAt(now);

            assertThat(entity.getCreatedAt()).isEqualTo(now);
        }

        @Test
        @DisplayName("应继承 updatedAt 字段")
        void shouldInheritUpdatedAt() {
            TestTenantEntity entity = new TestTenantEntity();
            Instant now = Instant.now();

            entity.setUpdatedAt(now);

            assertThat(entity.getUpdatedAt()).isEqualTo(now);
        }

        @Test
        @DisplayName("应继承 createdBy 字段")
        void shouldInheritCreatedBy() {
            TestTenantEntity entity = new TestTenantEntity();
            UUID userId = UUID.randomUUID();

            entity.setCreatedBy(userId);

            assertThat(entity.getCreatedBy()).isEqualTo(userId);
        }

        @Test
        @DisplayName("应继承 updatedBy 字段")
        void shouldInheritUpdatedBy() {
            TestTenantEntity entity = new TestTenantEntity();
            UUID userId = UUID.randomUUID();

            entity.setUpdatedBy(userId);

            assertThat(entity.getUpdatedBy()).isEqualTo(userId);
        }

        @Test
        @DisplayName("应继承 rowVersion 字段")
        void shouldInheritRowVersion() {
            TestTenantEntity entity = new TestTenantEntity();
            entity.setRowVersion(10L);

            assertThat(entity.getRowVersion()).isEqualTo(10L);
        }
    }

    /**
     * 测试用具体子类（TenantBaseEntity 是 abstract）
     */
    static class TestTenantEntity extends TenantBaseEntity {
    }
}
