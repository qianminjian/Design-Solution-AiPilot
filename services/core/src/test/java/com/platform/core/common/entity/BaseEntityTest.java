package com.platform.core.common.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * BaseEntity 单元测试
 *
 * 覆盖：
 * - getter/setter 行为
 * - 默认值（JPA 审计字段默认为 null，由 AuditingEntityListener 写入）
 * - rowVersion 乐观锁字段
 */
@DisplayName("BaseEntity 基础实体")
class BaseEntityTest {

    @Nested
    @DisplayName("createdAt 字段")
    class CreatedAtField {

        @Test
        @DisplayName("默认值为 null（由 JPA 审计写入）")
        void shouldBeNullByDefault() {
            TestEntity entity = new TestEntity();
            assertThat(entity.getCreatedAt()).isNull();
        }

        @Test
        @DisplayName("应允许设置并读取 Instant 值")
        void shouldSetAndGetInstant() {
            TestEntity entity = new TestEntity();
            Instant now = Instant.now();

            entity.setCreatedAt(now);

            assertThat(entity.getCreatedAt()).isEqualTo(now);
        }
    }

    @Nested
    @DisplayName("updatedAt 字段")
    class UpdatedAtField {

        @Test
        @DisplayName("默认值为 null")
        void shouldBeNullByDefault() {
            TestEntity entity = new TestEntity();
            assertThat(entity.getUpdatedAt()).isNull();
        }

        @Test
        @DisplayName("应允许设置并读取 Instant 值")
        void shouldSetAndGetInstant() {
            TestEntity entity = new TestEntity();
            Instant now = Instant.now();

            entity.setUpdatedAt(now);

            assertThat(entity.getUpdatedAt()).isEqualTo(now);
        }
    }

    @Nested
    @DisplayName("createdBy 字段")
    class CreatedByField {

        @Test
        @DisplayName("默认值为 null")
        void shouldBeNullByDefault() {
            TestEntity entity = new TestEntity();
            assertThat(entity.getCreatedBy()).isNull();
        }

        @Test
        @DisplayName("应允许设置并读取 UUID 值")
        void shouldSetAndGetUuid() {
            TestEntity entity = new TestEntity();
            UUID userId = UUID.randomUUID();

            entity.setCreatedBy(userId);

            assertThat(entity.getCreatedBy()).isEqualTo(userId);
        }
    }

    @Nested
    @DisplayName("updatedBy 字段")
    class UpdatedByField {

        @Test
        @DisplayName("默认值为 null")
        void shouldBeNullByDefault() {
            TestEntity entity = new TestEntity();
            assertThat(entity.getUpdatedBy()).isNull();
        }

        @Test
        @DisplayName("应允许设置并读取 UUID 值")
        void shouldSetAndGetUuid() {
            TestEntity entity = new TestEntity();
            UUID userId = UUID.randomUUID();

            entity.setUpdatedBy(userId);

            assertThat(entity.getUpdatedBy()).isEqualTo(userId);
        }
    }

    @Nested
    @DisplayName("rowVersion 字段（乐观锁）")
    class RowVersionField {

        @Test
        @DisplayName("默认值为 null（INSERT 时由 JPA 自动填充为 0）")
        void shouldBeNullByDefault() {
            TestEntity entity = new TestEntity();
            assertThat(entity.getRowVersion()).isNull();
        }

        @Test
        @DisplayName("应允许设置并读取 Long 值")
        void shouldSetAndGetLong() {
            TestEntity entity = new TestEntity();
            entity.setRowVersion(5L);

            assertThat(entity.getRowVersion()).isEqualTo(5L);
        }

        @Test
        @DisplayName("应支持 0 值（INSERT 后初始值）")
        void shouldSupportZeroValue() {
            TestEntity entity = new TestEntity();
            entity.setRowVersion(0L);

            assertThat(entity.getRowVersion()).isZero();
        }

        @Test
        @DisplayName("应支持大数值（防止溢出）")
        void shouldSupportLargeValue() {
            TestEntity entity = new TestEntity();
            entity.setRowVersion(Long.MAX_VALUE);

            assertThat(entity.getRowVersion()).isEqualTo(Long.MAX_VALUE);
        }
    }

    /**
     * 测试用具体子类（BaseEntity 是 abstract）
     */
    static class TestEntity extends BaseEntity {
    }
}
