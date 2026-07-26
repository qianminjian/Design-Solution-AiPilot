package com.platform.core.iam.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * PasswordEncoderConfig 单元测试
 *
 * 覆盖：
 * - passwordEncoder bean 应返回 BCryptPasswordEncoder 实例
 * - 编码结果应可被 matches 验证
 * - cost 强度应 ≥ 12（满足 security.md §2.3）
 *
 * 权威源：.trae/rules/security.md §2.3 密码存储
 */
@DisplayName("PasswordEncoderConfig 密码加密配置")
class PasswordEncoderConfigTest {

    @Test
    @DisplayName("passwordEncoder 应返回非 null 实例")
    void passwordEncoderShouldReturnInstance() {
        PasswordEncoderConfig config = new PasswordEncoderConfig();
        PasswordEncoder encoder = config.passwordEncoder();
        assertThat(encoder).isNotNull();
    }

    @Test
    @DisplayName("BCrypt 编码结果应可被 matches 验证")
    void encodedPasswordShouldBeMatched() {
        PasswordEncoderConfig config = new PasswordEncoderConfig();
        PasswordEncoder encoder = config.passwordEncoder();

        String rawPassword = "mySecret123!";
        String encoded = encoder.encode(rawPassword);

        assertThat(encoded).isNotEqualTo(rawPassword);
        assertThat(encoder.matches(rawPassword, encoded)).isTrue();
    }

    @Test
    @DisplayName("错误密码应匹配失败")
    void wrongPasswordShouldNotMatch() {
        PasswordEncoderConfig config = new PasswordEncoderConfig();
        PasswordEncoder encoder = config.passwordEncoder();

        String encoded = encoder.encode("correctPassword");
        assertThat(encoder.matches("wrongPassword", encoded)).isFalse();
    }

    @Test
    @DisplayName("同一密码多次编码应产生不同结果（盐随机）")
    void multipleEncodingsShouldDiffer() {
        PasswordEncoderConfig config = new PasswordEncoderConfig();
        PasswordEncoder encoder = config.passwordEncoder();

        String rawPassword = "samePassword123";
        String encoded1 = encoder.encode(rawPassword);
        String encoded2 = encoder.encode(rawPassword);

        assertThat(encoded1).isNotEqualTo(encoded2);
        // 但两者都应能匹配原文
        assertThat(encoder.matches(rawPassword, encoded1)).isTrue();
        assertThat(encoder.matches(rawPassword, encoded2)).isTrue();
    }

    @Test
    @DisplayName("BCrypt 编码结果长度应在 60 字符（cost=12 标准）")
    void encodedLengthShouldBeStandardBCrypt() {
        PasswordEncoderConfig config = new PasswordEncoderConfig();
        PasswordEncoder encoder = config.passwordEncoder();

        String encoded = encoder.encode("test");
        // BCrypt 编码结果固定 60 字符：$2a$<cost>$<22 位盐><31 位哈希>
        assertThat(encoded).hasSize(60);
        assertThat(encoded).startsWith("$2a$12$");
    }
}
