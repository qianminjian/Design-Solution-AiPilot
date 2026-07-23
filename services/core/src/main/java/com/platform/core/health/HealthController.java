package com.platform.core.health;

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
 * 提供服务健康状态、版本信息、数据库连接状态
 */
@RestController
public class HealthController {

    private final DataSource dataSource;
    private final BuildProperties buildProperties;

    public HealthController(DataSource dataSource, BuildProperties buildProperties) {
        this.dataSource = dataSource;
        this.buildProperties = buildProperties;
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
}
