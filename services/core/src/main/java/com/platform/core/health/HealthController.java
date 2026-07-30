package com.platform.core.health;

import com.platform.core.common.config.AppProperties;
import org.springframework.boot.info.BuildProperties;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * 健康检查控制器
 * 提供服务健康状态、版本信息、数据库与对象存储连接状态
 * 权威源：@design/D35-API-事件契约.md §D35.9 健康检查端点
 */
@RestController
public class HealthController {

    private final DataSource dataSource;
    private final BuildProperties buildProperties;
    private final AppProperties appProperties;

    public HealthController(DataSource dataSource, BuildProperties buildProperties, AppProperties appProperties) {
        this.dataSource = dataSource;
        this.buildProperties = buildProperties;
        this.appProperties = appProperties;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "ok");
        response.put("timestamp", Instant.now().toString());
        response.put("service", "core-service");
        response.put("version", buildProperties.getVersion());

        // 数据库连接检查
        try (Connection conn = dataSource.getConnection()) {
            boolean valid = conn.isValid(2);
            response.put("database", valid ? "connected" : "disconnected");
        } catch (Exception e) {
            response.put("database", "error");
            response.put("database_error", e.getMessage());
            return ResponseEntity.status(503).body(response);
        }

        return ResponseEntity.ok(response);
    }

    /**
     * 简单 Liveness 探针
     */
    @GetMapping("/health/live")
    public Map<String, String> live() {
        return Map.of("status", "up", "timestamp", Instant.now().toString());
    }

    /**
     * Readiness 探针 - 包含数据库连接检查
     */
    @GetMapping("/health/ready")
    public ResponseEntity<Map<String, String>> ready() {
        try (Connection conn = dataSource.getConnection()) {
            if (conn.isValid(2)) {
                return ResponseEntity.ok(Map.of("status", "ready"));
            }
            return ResponseEntity.status(503).body(Map.of("status", "not_ready", "reason", "database_unavailable"));
        } catch (Exception e) {
            return ResponseEntity.status(503).body(Map.of("status", "not_ready", "reason", e.getMessage()));
        }
    }

    /**
     * PostgreSQL 细粒度健康探针（BFF 透传）
     * - 2xx：数据库连接正常
     * - 503：连接异常
     */
    @GetMapping("/health/db")
    public ResponseEntity<Map<String, Object>> db() {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("service", "core-service");
        try (Connection conn = dataSource.getConnection()) {
            boolean valid = conn.isValid(2);
            body.put("status", valid ? "up" : "down");
            body.put("database", valid ? "connected" : "disconnected");
            if (!valid) {
                return ResponseEntity.status(503).body(body);
            }
            return ResponseEntity.ok(body);
        } catch (Exception e) {
            body.put("status", "down");
            body.put("database", "error");
            body.put("error", e.getMessage());
            return ResponseEntity.status(503).body(body);
        }
    }

    /**
     * 对象存储（MinIO/S3）细粒度健康探针（BFF 透传）
     * V0：检查配置完整性（未真正接入 MinIO SDK，避免误报）
     * V1：接入 MinIO SDK 后改为 bucket head 真实探测
     */
    @GetMapping("/health/storage")
    public ResponseEntity<Map<String, Object>> storage() {
        AppProperties.ObjectStorage cfg = appProperties.getObjectStorage();
        boolean configured = cfg.getEndpoint() != null && !cfg.getEndpoint().isBlank()
                && cfg.getAccessKey() != null && !cfg.getAccessKey().isBlank()
                && cfg.getSecretKey() != null && !cfg.getSecretKey().isBlank()
                && cfg.getBucket() != null && !cfg.getBucket().isBlank();
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("service", "core-service");
        body.put("status", configured ? "up" : "down");
        body.put("storage", configured ? "configured" : "misconfigured");
        body.put("endpoint", cfg.getEndpoint());
        body.put("bucket", cfg.getBucket());
        body.put("region", cfg.getRegion());
        // V0 不真正访问 MinIO，标记 mode 以便 BFF 区分
        body.put("mode", "V0_CONFIG_PROBE");
        if (!configured) {
            body.put("error", "object-storage config missing");
            return ResponseEntity.status(503).body(body);
        }
        return ResponseEntity.ok(body);
    }
}
