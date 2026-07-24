package com.platform.core.iam.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.dto.CreateMembershipRequest;
import com.platform.core.iam.dto.MembershipDto;
import com.platform.core.iam.service.MembershipService;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 成员关系控制器单元测试
 *
 * 覆盖：创建、详情、按主体查询列表。
 */
@ExtendWith(MockitoExtension.class)
class MembershipControllerTest {

    @Mock
    private MembershipService membershipService;

    @Mock
    private TenantResolver tenantResolver;

    @Mock
    private HttpServletRequest httpRequest;

    private MembershipController controller;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID membershipId = UUID.randomUUID();
    private final UUID principalId = UUID.randomUUID();
    private final UUID organizationId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new MembershipController(membershipService, tenantResolver);
        when(tenantResolver.resolveTenantId(httpRequest)).thenReturn(tenantId);
    }

    @Test
    @DisplayName("POST 创建成员关系应该返回 201 状态码")
    void createShouldReturn201() {
        // Arrange
        CreateMembershipRequest request = new CreateMembershipRequest(
                principalId, organizationId, "ADMIN", null, null);
        MembershipDto dto = buildMembershipDto();
        when(membershipService.createMembership(eq(tenantId), eq(request))).thenReturn(dto);

        // Act
        ResponseEntity<ApiResponse<MembershipDto>> response = controller.create(request, httpRequest);

        // Assert
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().data().id()).isEqualTo(membershipId);
        verify(membershipService).createMembership(eq(tenantId), eq(request));
    }

    @Test
    @DisplayName("GET /{id} 应该返回成员关系详情")
    void getShouldReturnMembershipDetail() {
        // Arrange
        MembershipDto dto = buildMembershipDto();
        when(membershipService.getMembership(eq(tenantId), eq(membershipId))).thenReturn(dto);

        // Act
        ApiResponse<MembershipDto> response = controller.get(membershipId, httpRequest);

        // Assert
        assertThat(response.data().id()).isEqualTo(membershipId);
        verify(membershipService).getMembership(eq(tenantId), eq(membershipId));
    }

    @Test
    @DisplayName("GET 按主体查询应该返回成员关系列表")
    void listByPrincipalShouldReturnMembershipList() {
        // Arrange
        MembershipDto dto = buildMembershipDto();
        when(membershipService.listByPrincipal(eq(tenantId), eq(principalId))).thenReturn(List.of(dto));

        // Act
        ApiResponse<List<MembershipDto>> response = controller.listByPrincipal(principalId, httpRequest);

        // Assert
        assertThat(response.data()).hasSize(1);
        verify(membershipService).listByPrincipal(eq(tenantId), eq(principalId));
    }

    private MembershipDto buildMembershipDto() {
        Instant now = Instant.now();
        return new MembershipDto(
                membershipId, tenantId, principalId, organizationId,
                "ADMIN", "ACTIVE", now, now, null,
                now, now, 1L
        );
    }
}
