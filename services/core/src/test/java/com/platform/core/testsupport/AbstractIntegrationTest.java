package com.platform.core.testsupport;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.iam.domain.DataClassification;
import com.platform.core.iam.domain.Principal;
import com.platform.core.iam.domain.Tenant;
import com.platform.core.iam.repository.PrincipalRepository;
import com.platform.core.iam.repository.TenantRepository;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.UUID;

/**
 * 集成测试基类
 *
 * <p>使用 TestContainers 启动真实 PostgreSQL 16 容器，验证 Flyway 迁移、JPA 实体映射与 REST API 端点。
 * 不使用 H2 内存数据库，确保与生产环境一致的 PostgreSQL 行为（uuid-ossp / jsonb / 枚举类型）。
 *
 * <p>测试 profile=application-test.yml，JWT 密钥固定，Spring Security 启用，
 * 受保护端点需通过 {@link #withAccessToken(UUID, String)} 获取 access token 后携带 Authorization 头。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Testcontainers
public abstract class AbstractIntegrationTest {

    /** PostgreSQL 16 容器，复用 JDBC URL（同模块测试共享，加快启动） */
    @Container
    protected static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("core_service_test")
            .withUsername("test")
            .withPassword("test");

    /** 系统租户 ID（V4 迁移文件预置） */
    public static final UUID SYSTEM_TENANT_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    /** 默认测试密码（满足登录密码策略：至少 8 位 + 字母 + 数字） */
    public static final String DEFAULT_TEST_PASSWORD = "Test1234";

    /** JWT access token 类型前缀 */
    private static final String BEARER_PREFIX = "Bearer ";

    /** 租户请求头名 */
    public static final String TENANT_HEADER = "x-tenant-id";

    @LocalServerPort
    protected int port;

    @Autowired
    protected TestRestTemplate restTemplate;

    @Autowired
    protected ObjectMapper objectMapper;

    @Autowired
    protected TenantRepository tenantRepository;

    @Autowired
    protected PrincipalRepository principalRepository;

    @Autowired
    protected PasswordEncoder passwordEncoder;

    /**
     * 将容器 JDBC 连接信息注入 Spring 配置
     */
    @DynamicPropertySource
    static void postgresProps(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    }

    /**
     * 创建测试租户并返回租户 ID
     *
     * <p>每次调用生成独立租户，避免不同测试间数据污染。
     *
     * @param code 租户编码（全局唯一）
     * @return 新建的租户 ID
     */
    protected UUID createTestTenant(String code) {
        Tenant tenant = new Tenant();
        tenant.setName("Test Tenant " + code);
        tenant.setCode(code);
        tenant.setStatus("ACTIVE");
        tenant.setRegion("us-east-1");
        tenant.setLanguage("en");
        tenant.setClassification(DataClassification.PROJECT_RECORD);
        tenant.setSettings("{}");
        Tenant saved = tenantRepository.save(tenant);
        return saved.getId();
    }

    /**
     * 创建测试主体（直接通过 Repository 写入，密码使用 BCrypt 加密）
     *
     * @param tenantId 租户 ID
     * @param email    邮箱（租户内唯一）
     * @return 新建主体 ID
     */
    protected UUID createTestPrincipal(UUID tenantId, String email) {
        Principal principal = new Principal();
        principal.setTenantId(tenantId);
        principal.setType("USER");
        principal.setEmail(email);
        principal.setDisplayName("Tester " + email);
        principal.setStatus("ACTIVE");
        principal.setPasswordHash(passwordEncoder.encode(DEFAULT_TEST_PASSWORD));
        principal.setLocale("en");
        principal.setTimezone("UTC");
        principal.setClassification(DataClassification.SENSITIVE);
        principal.setMetadata("{}");
        Principal saved = principalRepository.save(principal);
        return saved.getId();
    }

    /**
     * 登录并返回 access token
     *
     * @param tenantId 租户 ID
     * @param email    邮箱
     * @return access token 字符串
     */
    protected String loginAndGetAccessToken(UUID tenantId, String email) {
        HttpHeaders headers = jsonHeaders(tenantId);
        String body = """
                {"email":"%s","password":"%s"}
                """.formatted(email, DEFAULT_TEST_PASSWORD);
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/auth/login", HttpMethod.POST,
                new HttpEntity<>(body, headers), String.class);
        if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
            throw new IllegalStateException("登录失败 status=" + resp.getStatusCode()
                    + " body=" + resp.getBody());
        }
        try {
            JsonNode root = objectMapper.readTree(resp.getBody());
            return root.path("data").path("accessToken").asText();
        } catch (Exception ex) {
            throw new IllegalStateException("解析登录响应失败: " + resp.getBody(), ex);
        }
    }

    /**
     * 构造带 access token 的请求头（用于受保护端点）
     *
     * @param tenantId    租户 ID
     * @param accessToken access token
     * @return 已添加 Content-Type / x-tenant-id / Authorization 的请求头
     */
    protected HttpHeaders withAccessToken(UUID tenantId, String accessToken) {
        HttpHeaders headers = jsonHeaders(tenantId);
        headers.set(HttpHeaders.AUTHORIZATION, BEARER_PREFIX + accessToken);
        return headers;
    }

    /**
     * 构造 JSON + 租户请求头（不带认证，用于公开端点）
     */
    protected HttpHeaders jsonHeaders(UUID tenantId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(TENANT_HEADER, tenantId.toString());
        return headers;
    }

    /**
     * 提取响应体业务码（ApiResponse.code）
     */
    protected int extractCode(String body) throws Exception {
        return objectMapper.readTree(body).path("code").asInt();
    }

    /**
     * 提取响应体 data 节点
     */
    protected JsonNode extractData(String body) throws Exception {
        return objectMapper.readTree(body).path("data");
    }

    /**
     * 提取响应体 message 字段
     */
    protected String extractMessage(String body) throws Exception {
        return objectMapper.readTree(body).path("message").asText();
    }
}
