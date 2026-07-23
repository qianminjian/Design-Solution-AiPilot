package com.platform.core.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 应用配置属性
 * 从 application.yml 的 app.* 节点加载
 */
@Configuration
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private String name;
    private String version;
    private String timezone;
    private Security security = new Security();
    private Cors cors = new Cors();
    private ObjectStorage objectStorage = new ObjectStorage();

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public String getTimezone() {
        return timezone;
    }

    public void setTimezone(String timezone) {
        this.timezone = timezone;
    }

    public Security getSecurity() {
        return security;
    }

    public void setSecurity(Security security) {
        this.security = security;
    }

    public ObjectStorage getObjectStorage() {
        return objectStorage;
    }

    public void setObjectStorage(ObjectStorage objectStorage) {
        this.objectStorage = objectStorage;
    }

    public Cors getCors() {
        return cors;
    }

    public void setCors(Cors cors) {
        this.cors = cors;
    }

    public static class Security {
        private String jwtSecret;
        private String accessTokenExpire;
        private String refreshTokenExpire;

        public String getJwtSecret() {
            return jwtSecret;
        }

        public void setJwtSecret(String jwtSecret) {
            this.jwtSecret = jwtSecret;
        }

        public String getAccessTokenExpire() {
            return accessTokenExpire;
        }

        public void setAccessTokenExpire(String accessTokenExpire) {
            this.accessTokenExpire = accessTokenExpire;
        }

        public String getRefreshTokenExpire() {
            return refreshTokenExpire;
        }

        public void setRefreshTokenExpire(String refreshTokenExpire) {
            this.refreshTokenExpire = refreshTokenExpire;
        }
    }

    public static class ObjectStorage {
        private String endpoint;
        private String accessKey;
        private String secretKey;
        private String bucket;
        private String region;

        public String getEndpoint() {
            return endpoint;
        }

        public void setEndpoint(String endpoint) {
            this.endpoint = endpoint;
        }

        public String getAccessKey() {
            return accessKey;
        }

        public void setAccessKey(String accessKey) {
            this.accessKey = accessKey;
        }

        public String getSecretKey() {
            return secretKey;
        }

        public void setSecretKey(String secretKey) {
            this.secretKey = secretKey;
        }

        public String getBucket() {
            return bucket;
        }

        public void setBucket(String bucket) {
            this.bucket = bucket;
        }

        public String getRegion() {
            return region;
        }

        public void setRegion(String region) {
            this.region = region;
        }
    }

    /**
     * CORS 跨域配置
     * 默认仅允许 BFF 域，禁止 *（见 security.md §7）
     */
    public static class Cors {
        /** 允许的来源列表（逗号分隔），从 app.cors.allowed-origins 读取 */
        private String allowedOrigins = "http://localhost:3000";

        public String getAllowedOrigins() {
            return allowedOrigins;
        }

        public void setAllowedOrigins(String allowedOrigins) {
            this.allowedOrigins = allowedOrigins;
        }

        /**
         * 将逗号分隔的 origins 字符串拆为数组
         */
        public String[] allowedOriginsArray() {
            if (allowedOrigins == null || allowedOrigins.isBlank()) {
                return new String[0];
            }
            return allowedOrigins.split("\\s*,\\s*");
        }
    }
}
