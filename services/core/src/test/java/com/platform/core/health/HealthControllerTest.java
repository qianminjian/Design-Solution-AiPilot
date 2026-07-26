package com.platform.core.health;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.info.BuildProperties;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import javax.sql.DataSource;
import java.sql.Connection;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * HealthController 单元测试
 *
 * <p>使用 @WebMvcTest 切片，仅加载 HealthController，DataSource 与 BuildProperties 通过 MockBean 注入。
 *
 * <p>覆盖：
 * <ul>
 *   <li>/health 正常路径与数据库异常路径</li>
 *   <li>/health/live Liveness 探针</li>
 *   <li>/health/ready Readiness 探针正常与异常路径</li>
 * </ul>
 */
@DisplayName("HealthController 健康检查端点")
@WebMvcTest(HealthController.class)
@AutoConfigureMockMvc(addFilters = false)
class HealthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DataSource dataSource;

    @MockBean
    private BuildProperties buildProperties;

    @Nested
    @DisplayName("/health 完整健康检查")
    class Health {

        @Test
        @DisplayName("数据库正常时应返回 200 与 connected 状态")
        void shouldReturnOkWhenDatabaseConnected() throws Exception {
            // Arrange
            Connection mockConn = mock(Connection.class);
            when(mockConn.isValid(anyInt())).thenReturn(true);
            when(dataSource.getConnection()).thenReturn(mockConn);
            when(buildProperties.getVersion()).thenReturn("1.0.0-test");

            // Act + Assert
            mockMvc.perform(get("/health"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("ok"))
                    .andExpect(jsonPath("$.service").value("core-service"))
                    .andExpect(jsonPath("$.version").value("1.0.0-test"))
                    .andExpect(jsonPath("$.database").value("connected"))
                    .andExpect(jsonPath("$.timestamp").exists());
        }

        @Test
        @DisplayName("数据库 isValid=false 时应返回 200 与 disconnected 状态")
        void shouldReturnOkWhenDatabaseDisconnected() throws Exception {
            // Arrange
            Connection mockConn = mock(Connection.class);
            when(mockConn.isValid(anyInt())).thenReturn(false);
            when(dataSource.getConnection()).thenReturn(mockConn);
            when(buildProperties.getVersion()).thenReturn("1.0.0-test");

            // Act + Assert
            mockMvc.perform(get("/health"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("ok"))
                    .andExpect(jsonPath("$.database").value("disconnected"));
        }

        @Test
        @DisplayName("获取连接抛异常时应返回 503 与 error 状态")
        void shouldReturn503WhenGetConnectionThrows() throws Exception {
            // Arrange
            when(dataSource.getConnection())
                    .thenThrow(new java.sql.SQLException("Connection refused"));
            when(buildProperties.getVersion()).thenReturn("1.0.0-test");

            // Act + Assert
            mockMvc.perform(get("/health"))
                    .andExpect(status().isServiceUnavailable())
                    .andExpect(jsonPath("$.status").value("ok"))
                    .andExpect(jsonPath("$.database").value("error"))
                    .andExpect(jsonPath("$.database_error").exists());
        }
    }

    @Nested
    @DisplayName("/health/live Liveness 探针")
    class Live {

        @Test
        @DisplayName("应始终返回 200 与 up 状态")
        void shouldAlwaysReturnUp() throws Exception {
            // Act + Assert
            mockMvc.perform(get("/health/live"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("up"))
                    .andExpect(jsonPath("$.timestamp").exists());
        }
    }

    @Nested
    @DisplayName("/health/ready Readiness 探针")
    class Ready {

        @Test
        @DisplayName("数据库正常时应返回 200 与 ready 状态")
        void shouldReturnReadyWhenDatabaseConnected() throws Exception {
            // Arrange
            Connection mockConn = mock(Connection.class);
            when(mockConn.isValid(anyInt())).thenReturn(true);
            when(dataSource.getConnection()).thenReturn(mockConn);

            // Act + Assert
            mockMvc.perform(get("/health/ready"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("ready"));
        }

        @Test
        @DisplayName("数据库 isValid=false 时应返回 503 与 database_unavailable")
        void shouldReturnNotReadyWhenDatabaseInvalid() throws Exception {
            // Arrange
            Connection mockConn = mock(Connection.class);
            when(mockConn.isValid(anyInt())).thenReturn(false);
            when(dataSource.getConnection()).thenReturn(mockConn);

            // Act + Assert
            mockMvc.perform(get("/health/ready"))
                    .andExpect(status().isServiceUnavailable())
                    .andExpect(jsonPath("$.status").value("not_ready"))
                    .andExpect(jsonPath("$.reason").value("database_unavailable"));
        }

        @Test
        @DisplayName("获取连接抛异常时应返回 503 与异常原因")
        void shouldReturnNotReadyWhenGetConnectionThrows() throws Exception {
            // Arrange
            when(dataSource.getConnection())
                    .thenThrow(new java.sql.SQLException("Connection refused"));

            // Act + Assert
            mockMvc.perform(get("/health/ready"))
                    .andExpect(status().isServiceUnavailable())
                    .andExpect(jsonPath("$.status").value("not_ready"))
                    .andExpect(jsonPath("$.reason").exists());
        }
    }
}
