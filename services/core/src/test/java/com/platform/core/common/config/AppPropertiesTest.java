package com.platform.core.common.config;

import com.platform.core.common.config.AppProperties.Cors;
import com.platform.core.common.config.AppProperties.ObjectStorage;
import com.platform.core.common.config.AppProperties.Security;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * AppProperties 配置属性单元测试
 *
 * 覆盖：
 * - 默认值（cors 默认 localhost:3000、嵌套对象初始化）
 * - getter/setter
 * - Cors.allowedOriginsArray()：逗号分隔拆分、空白裁剪、空值兜底
 *
 * 权威源：.trae/rules/security.md §7 CORS 白名单（禁止 *）
 */
@DisplayName("AppProperties 配置属性")
class AppPropertiesTest {

    @Nested
    @DisplayName("默认值")
    class Defaults {

        @Test
        @DisplayName("新建实例时 cors 应被初始化为非 null")
        void corsShouldBeInitialized() {
            AppProperties props = new AppProperties();
            assertThat(props.getCors()).isNotNull();
        }

        @Test
        @DisplayName("新建实例时 security 应被初始化为非 null")
        void securityShouldBeInitialized() {
            AppProperties props = new AppProperties();
            assertThat(props.getSecurity()).isNotNull();
        }

        @Test
        @DisplayName("新建实例时 objectStorage 应被初始化为非 null")
        void objectStorageShouldBeInitialized() {
            AppProperties props = new AppProperties();
            assertThat(props.getObjectStorage()).isNotNull();
        }

        @Test
        @DisplayName("Cors 默认 allowedOrigins 应为 localhost:3000")
        void corsDefaultShouldBeLocalhost() {
            Cors cors = new Cors();
            assertThat(cors.getAllowedOrigins()).isEqualTo("http://localhost:3000");
        }
    }

    @Nested
    @DisplayName("基础字段 getter/setter")
    class BasicFields {

        @Test
        @DisplayName("name 应可读写")
        void nameShouldBeReadWrite() {
            AppProperties props = new AppProperties();
            props.setName("core-service");
            assertThat(props.getName()).isEqualTo("core-service");
        }

        @Test
        @DisplayName("version 应可读写")
        void versionShouldBeReadWrite() {
            AppProperties props = new AppProperties();
            props.setVersion("1.0.0");
            assertThat(props.getVersion()).isEqualTo("1.0.0");
        }

        @Test
        @DisplayName("timezone 应可读写")
        void timezoneShouldBeReadWrite() {
            AppProperties props = new AppProperties();
            props.setTimezone("UTC");
            assertThat(props.getTimezone()).isEqualTo("UTC");
        }
    }

    @Nested
    @DisplayName("Security 嵌套配置")
    class SecurityConfig {

        @Test
        @DisplayName("jwtSecret 应可读写")
        void jwtSecretShouldBeReadWrite() {
            Security security = new Security();
            security.setJwtSecret("super-secret-key");
            assertThat(security.getJwtSecret()).isEqualTo("super-secret-key");
        }

        @Test
        @DisplayName("accessTokenExpire 应可读写")
        void accessTokenExpireShouldBeReadWrite() {
            Security security = new Security();
            security.setAccessTokenExpire("PT15M");
            assertThat(security.getAccessTokenExpire()).isEqualTo("PT15M");
        }

        @Test
        @DisplayName("refreshTokenExpire 应可读写")
        void refreshTokenExpireShouldBeReadWrite() {
            Security security = new Security();
            security.setRefreshTokenExpire("P7D");
            assertThat(security.getRefreshTokenExpire()).isEqualTo("P7D");
        }

        @Test
        @DisplayName("AppProperties.setSecurity 应替换整个 Security 对象")
        void setSecurityShouldReplaceObject() {
            AppProperties props = new AppProperties();
            Security security = new Security();
            security.setJwtSecret("new-secret");
            props.setSecurity(security);
            assertThat(props.getSecurity().getJwtSecret()).isEqualTo("new-secret");
        }
    }

    @Nested
    @DisplayName("ObjectStorage 嵌套配置")
    class ObjectStorageConfig {

        @Test
        @DisplayName("endpoint 应可读写")
        void endpointShouldBeReadWrite() {
            ObjectStorage storage = new ObjectStorage();
            storage.setEndpoint("http://localhost:9000");
            assertThat(storage.getEndpoint()).isEqualTo("http://localhost:9000");
        }

        @Test
        @DisplayName("accessKey 应可读写")
        void accessKeyShouldBeReadWrite() {
            ObjectStorage storage = new ObjectStorage();
            storage.setAccessKey("minio-admin");
            assertThat(storage.getAccessKey()).isEqualTo("minio-admin");
        }

        @Test
        @DisplayName("secretKey 应可读写")
        void secretKeyShouldBeReadWrite() {
            ObjectStorage storage = new ObjectStorage();
            storage.setSecretKey("minio-secret");
            assertThat(storage.getSecretKey()).isEqualTo("minio-secret");
        }

        @Test
        @DisplayName("bucket 应可读写")
        void bucketShouldBeReadWrite() {
            ObjectStorage storage = new ObjectStorage();
            storage.setBucket("cde-files");
            assertThat(storage.getBucket()).isEqualTo("cde-files");
        }

        @Test
        @DisplayName("region 应可读写")
        void regionShouldBeReadWrite() {
            ObjectStorage storage = new ObjectStorage();
            storage.setRegion("us-east-1");
            assertThat(storage.getRegion()).isEqualTo("us-east-1");
        }
    }

    @Nested
    @DisplayName("Cors.allowedOriginsArray()")
    class AllowedOriginsArray {

        @Test
        @DisplayName("默认值应返回 localhost:3000")
        void defaultShouldReturnLocalhost() {
            Cors cors = new Cors();
            String[] origins = cors.allowedOriginsArray();
            assertThat(origins).containsExactly("http://localhost:3000");
        }

        @Test
        @DisplayName("单个 origin 应正常返回")
        void singleOriginShouldReturnArray() {
            Cors cors = new Cors();
            cors.setAllowedOrigins("https://app.example.com");
            assertThat(cors.allowedOriginsArray()).containsExactly("https://app.example.com");
        }

        @Test
        @DisplayName("逗号分隔多个 origin 应拆分数组")
        void multipleOriginsShouldSplit() {
            Cors cors = new Cors();
            cors.setAllowedOrigins("https://a.com,https://b.com,https://c.com");
            assertThat(cors.allowedOriginsArray())
                    .containsExactly("https://a.com", "https://b.com", "https://c.com");
        }

        @Test
        @DisplayName("逗号分隔包含空白应被裁剪")
        void originsWithWhitespaceShouldBeTrimmed() {
            Cors cors = new Cors();
            cors.setAllowedOrigins("https://a.com , https://b.com , https://c.com");
            assertThat(cors.allowedOriginsArray())
                    .containsExactly("https://a.com", "https://b.com", "https://c.com");
        }

        @Test
        @DisplayName("null 字符串应返回空数组")
        void nullOriginsShouldReturnEmptyArray() {
            Cors cors = new Cors();
            cors.setAllowedOrigins(null);
            assertThat(cors.allowedOriginsArray()).isEmpty();
        }

        @Test
        @DisplayName("空字符串应返回空数组")
        void emptyOriginsShouldReturnEmptyArray() {
            Cors cors = new Cors();
            cors.setAllowedOrigins("");
            assertThat(cors.allowedOriginsArray()).isEmpty();
        }

        @Test
        @DisplayName("纯空白字符串应返回空数组")
        void blankOriginsShouldReturnEmptyArray() {
            Cors cors = new Cors();
            cors.setAllowedOrigins("   ");
            assertThat(cors.allowedOriginsArray()).isEmpty();
        }
    }
}
