package com.platform.core.testsupport;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.iam.domain.DataClassification;
import com.platform.core.iam.domain.Principal;
import com.platform.core.iam.domain.Tenant;
import com.platform.core.iam.repository.PrincipalRepository;
import com.platform.core.iam.repository.TenantRepository;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.util.concurrent.atomic.AtomicBoolean;

import javax.sql.DataSource;
import java.util.UUID;

/**
 * 集成测试基类
 *
 * <p>使用 docker-compose 启动的 PostgreSQL 16（localhost:5432）作为测试数据库。
 * 每个测试子类运行前通过 Flyway clean + migrate 重置 schema，确保测试隔离。
 *
 * <p>不使用 H2 内存数据库，确保与生产环境一致的 PostgreSQL 行为（uuid-ossp / jsonb / 枚举类型）。
 *
 * <p>测试 profile=application-test.yml，JWT 密钥固定，Spring Security 启用，
 * 受保护端点需通过 {@link #withAccessToken(UUID, String)} 获取 access token 后携带 Authorization 头。
 *
 * <p>环境要求：本地启动 docker compose（postgres + minio + chromadb），且 design_platform_test 库已创建。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
public abstract class AbstractIntegrationTest {

    /** 测试数据库连接 URL（独立测试库，避免污染开发数据库）
     *
     * <p>关键参数 stringtype=unspecified：让 PostgreSQL JDBC 驱动不强制 VARCHAR 类型，
     * 服务器自动推断并转换为自定义枚举类型（如 data_classification），
     * 解决 JPA @Enumerated(STRING) 与 PostgreSQL CREATE TYPE ... AS ENUM 不匹配问题。
     */
    private static final String TEST_DB_URL = "jdbc:postgresql://localhost:5432/design_platform_test?stringtype=unspecified";

    private static final String TEST_DB_USER = "platform";

    private static final String TEST_DB_PASSWORD = "platform_dev";

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

    @Autowired
    protected JdbcTemplate jdbcTemplate;

    @Autowired
    protected DataSource dataSource;

    /**
     * 全局 Flyway 重置标志：保证整个测试套件只执行一次 Flyway clean + migrate。
     *
     * <p>多次执行 Flyway clean 会删除并重建 PostgreSQL 自定义枚举类型（如 data_classification），
     * OID 变化会导致连接池中已缓存的 PreparedStatement 引用失效类型，
     * 触发 "cache lookup failed for type XXXXX" 错误。
     *
     * <p>使用 AtomicBoolean 保证多线程下也只执行一次。
     */
    private static final AtomicBoolean FLYWAY_INITIALIZED = new AtomicBoolean(false);

    /**
     * 在所有测试启动前重置数据库 schema（仅执行一次）
     *
     * <p>通过 Flyway clean + migrate 完成：clean 删除所有 schema 中的所有对象，
     * migrate 重新执行所有迁移脚本，恢复到初始状态。
     *
     * <p>关键点：
     * <ul>
     *   <li>Spring Boot 自动 Flyway 已通过 @DynamicPropertySource 禁用
     *       （spring.flyway.enabled=false），由本方法完全控制，避免残留旧表导致 V1 迁移失败。</li>
     *   <li>JPA ddl-auto 设为 none，避免 Hibernate 在表创建前 validate 失败。</li>
     *   <li>使用全局 AtomicBoolean 保证只执行一次，避免 OID 变化引发 PostgreSQL 类型缓存错误。</li>
     * </ul>
     */
    @BeforeAll
    static void resetDatabase(@Autowired DataSource dataSource) {
        if (!FLYWAY_INITIALIZED.compareAndSet(false, true)) {
            // 已初始化过，跳过，避免重复 clean 导致 OID 变化
            return;
        }
        // Flyway 9.x 对 PostgreSQL 的 clean 仅清理 defaultSchema 中的对象，
        // schemas 列表中其他 schema 不会自动清理。若旧测试遗留 governance 等业务 schema 中的表，
        // V17 重跑 CREATE TABLE governance.access_grant 会报 42P07 "relation already exists"。
        // 解决方案：先用 JdbcTemplate 手动 DROP 所有业务 schema（CASCADE），再 Flyway clean + migrate。
        org.springframework.jdbc.core.JdbcTemplate cleanup = new org.springframework.jdbc.core.JdbcTemplate(dataSource);
        try {
            cleanup.execute("""
                    DROP SCHEMA IF EXISTS operations CASCADE;
                    DROP SCHEMA IF EXISTS change CASCADE;
                    DROP SCHEMA IF EXISTS governance CASCADE;
                    DROP SCHEMA IF EXISTS compliance CASCADE;
                    DROP SCHEMA IF EXISTS ai CASCADE;
                    DROP SCHEMA IF EXISTS platform CASCADE;
                    DROP SCHEMA IF EXISTS cde CASCADE;
                    DROP SCHEMA IF EXISTS workflow CASCADE;
                    DROP SCHEMA IF EXISTS requirement CASCADE;
                    DROP SCHEMA IF EXISTS portfolio CASCADE;
                    DROP SCHEMA IF EXISTS iam CASCADE;
                    """);
        } catch (Exception e) {
            // 忽略：可能 schema 不存在
            System.err.println("[AbstractIntegrationTest] DROP SCHEMA warning: " + e.getMessage());
        }
        // 显式指定所有 schema 进行 clean：Flyway 默认只清理 default-schema
        // defaultSchema=public：让 V8/V9 等迁移脚本中无 schema 前缀的 CREATE TABLE 创建在 public 下
        // schemas 列表必须包含所有业务 schema，clean 才会全部清理
        // 缺少 governance 会导致 V17 重跑时 access_grant 表已存在而报 42P07
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .baselineVersion("0")
                .cleanDisabled(false)
                .defaultSchema("public")
                .schemas("iam", "portfolio", "requirement", "workflow", "cde", "ai", "platform", "compliance", "governance", "change", "operations", "public")
                .load();
        // clean 会删除所有指定 schema 及其中的对象（包括 flyway_schema_history 表）
        flyway.clean();
        // migrate 重新执行所有迁移脚本
        flyway.migrate();
    }

    /**
     * 每个测试方法前清理业务数据（不重置 schema，避免 OID 变化）
     *
     * <p>通过 TRUNCATE CASCADE 清空所有业务表数据，保留 schema 结构与枚举类型，
     * 确保测试间数据隔离，同时避免重置 schema 导致的 PostgreSQL 类型缓存错误。
     */
    @BeforeEach
    void truncateBusinessData() {
        truncateBusinessTables();
    }

    /**
     * 注入测试数据源配置（指向 docker-compose 启动的 postgres + 独立测试库）
     *
     * <p>关键：禁用 Spring Boot 自动 Flyway（spring.flyway.enabled=false），
     * 由 AbstractIntegrationTest.resetDatabase() 完全控制，避免残留旧表导致 V1 迁移失败。
     * JPA ddl-auto 设为 none，避免 Hibernate 在 Flyway 执行前 validate 失败。
     */
    @DynamicPropertySource
    static void postgresProps(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> TEST_DB_URL);
        registry.add("spring.datasource.username", () -> TEST_DB_USER);
        registry.add("spring.datasource.password", () -> TEST_DB_PASSWORD);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        // 禁用 Spring Boot 自动 Flyway，由测试代码控制
        registry.add("spring.flyway.enabled", () -> false);
        // JPA 不 validate，由 Flyway 负责建表
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "none");
    }

    /**
     * 清理所有业务数据表（保留 schema 结构与枚举类型）
     *
     * <p>每个测试子类可通过 {@code @BeforeEach} 调用，确保测试间数据隔离。
     * 使用 TRUNCATE CASCADE 处理外键依赖，RESTART IDENTITY 重置序列。
     *
     * <p>表名严格对齐 V1-V13 迁移脚本中的 CREATE TABLE 语句（单数形式，带 schema 前缀）。
     *
     * <p>注意：TRUNCATE 会清空 V4 种子数据（系统租户、系统管理员、PLATFORM_ADMIN 角色绑定），
     * 因此清理后需要重新执行种子数据插入，确保 FlywayMigrationIT 等测试可验证种子数据存在。
     */
    protected void truncateBusinessTables() {
        jdbcTemplate.execute("""
                TRUNCATE TABLE
                    public.verification_execution,
                    public.verification_item,
                    public.golden_dataset,
                    public.design_feedback,
                    public.design_option,
                    public.ai_generation_record,
                    compliance.compliance_findings,
                    compliance.check_results,
                    compliance.rule_executions,
                    compliance.compliance_check_runs,
                    compliance.rule_set_rules,
                    compliance.rule_revisions,
                    compliance.compliance_rule_sets,
                    compliance.compliance_rules,
                    ai.guardrail_result,
                    ai.tool_call,
                    ai.run,
                    ai.capability_revision,
                    platform.outbox_event,
                    cde.transmittal,
                    cde.baseline_item,
                    cde.rendition,
                    cde.object_manifest,
                    cde.asset_version,
                    cde.asset,
                    cde.document_version,
                    cde.document,
                    workflow.attempt,
                    workflow.task,
                    workflow.timer,
                    workflow.instance,
                    workflow.definition_revision,
                    workflow.project_baseline,
                    workflow.gate_decision,
                    workflow.stage_instance,
                    portfolio.project_baseline,
                    portfolio.gate_decision,
                    portfolio.stage_instance,
                    portfolio.project,
                    requirement.trace_link,
                    requirement.requirement_revision,
                    requirement.source,
                    governance.restore_drill,
                    governance.backup_point,
                    governance.evidence_item,
                    governance.evidence_package,
                    governance.audit_log,
                    governance.data_asset,
                    governance.releases,
                    governance.access_grant,
                    change.change_operation,
                    change.closure_evidence,
                    change.task_plan_item,
                    change.affected_item,
                    change.change_request,
                    operations.operations_action,
                    operations.connector_status,
                    operations.worker_status,
                    operations.queue_task,
                    operations.slo_target,
                    iam.role_binding,
                    iam.access_grant,
                    iam.membership,
                    iam.organization,
                    iam.principal,
                    iam.tenant
                RESTART IDENTITY CASCADE
                """);
        // 重新插入 V4 种子数据（系统租户、组织、管理员、成员关系、角色绑定）
        // 确保 FlywayMigrationIT.shouldHaveSeedData 等测试可验证种子数据存在
        reseedSystemData();
    }

    /**
     * 重新插入 V4 种子数据
     *
     * <p>TRUNCATE 清空了 V4 迁移插入的系统租户、组织、管理员、成员关系与角色绑定，
     * 需要在每个测试方法前重新插入，保证依赖种子数据的测试可正常执行。
     */
    private void reseedSystemData() {
        jdbcTemplate.execute("""
                INSERT INTO iam.tenant (id, name, code, status, region, language, classification)
                VALUES (
                    '00000000-0000-0000-0000-000000000001',
                    'System Tenant',
                    'system',
                    'ACTIVE',
                    'us-east-1',
                    'en',
                    'PROJECT_RECORD'
                )
                ON CONFLICT (id) DO NOTHING;

                INSERT INTO iam.organization (id, tenant_id, name, type, status)
                VALUES (
                    '00000000-0000-0000-0000-000000000002',
                    '00000000-0000-0000-0000-000000000001',
                    'Platform Admin',
                    'ORGANIZATION',
                    'ACTIVE'
                )
                ON CONFLICT (id) DO NOTHING;

                INSERT INTO iam.principal (
                    id, tenant_id, type, email, display_name, status,
                    password_hash, locale, timezone, classification
                )
                VALUES (
                    '00000000-0000-0000-0000-000000000003',
                    '00000000-0000-0000-0000-000000000001',
                    'USER',
                    'admin@platform.local',
                    'Platform Admin',
                    'ACTIVE',
                    '$2a$12$R9h/cIPz0gyWvyI9Apf1O.zVq9zGkP9nN8nLz7kWnqQpJY5J8l8eS',
                    'en',
                    'UTC',
                    'SENSITIVE'
                )
                ON CONFLICT (id) DO NOTHING;

                INSERT INTO iam.membership (
                    tenant_id, principal_id, organization_id, role, status
                )
                SELECT
                    '00000000-0000-0000-0000-000000000001',
                    '00000000-0000-0000-0000-000000000003',
                    '00000000-0000-0000-0000-000000000002',
                    'ADMIN',
                    'ACTIVE'
                WHERE NOT EXISTS (
                    SELECT 1 FROM iam.membership
                    WHERE principal_id = '00000000-0000-0000-0000-000000000003'
                      AND organization_id = '00000000-0000-0000-0000-000000000002'
                );

                INSERT INTO iam.role_binding (
                    tenant_id, principal_id, role_code, scope_type, scope_id, status, granted_by
                )
                SELECT
                    '00000000-0000-0000-0000-000000000001',
                    '00000000-0000-0000-0000-000000000003',
                    'PLATFORM_ADMIN',
                    'TENANT',
                    '00000000-0000-0000-0000-000000000001',
                    'ACTIVE',
                    '00000000-0000-0000-0000-000000000003'
                WHERE NOT EXISTS (
                    SELECT 1 FROM iam.role_binding
                    WHERE principal_id = '00000000-0000-0000-0000-000000000003'
                      AND role_code = 'PLATFORM_ADMIN'
                      AND scope_type = 'TENANT'
                );
                """);
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
