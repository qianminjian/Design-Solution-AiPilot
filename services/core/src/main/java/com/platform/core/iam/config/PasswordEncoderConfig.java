package com.platform.core.iam.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * 密码加密配置
 * 使用 BCrypt（cost ≥ 12，见 security.md §2.3）
 */
@Configuration
public class PasswordEncoderConfig {

    /** BCrypt cost 强度（≥12 满足安全规则） */
    private static final int BCRYPT_STRENGTH = 12;

    /**
     * 暴露 BCrypt 密码编码器
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(BCRYPT_STRENGTH);
    }
}
