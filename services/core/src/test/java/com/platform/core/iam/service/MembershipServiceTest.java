package com.platform.core.iam.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.iam.domain.Membership;
import com.platform.core.iam.domain.Organization;
import com.platform.core.iam.domain.Principal;
import com.platform.core.iam.dto.CreateMembershipRequest;
import com.platform.core.iam.dto.MembershipDto;
import com.platform.core.iam.repository.MembershipRepository;
import com.platform.core.iam.repository.OrganizationRepository;
import com.platform.core.iam.repository.PrincipalRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * MembershipService 单元测试
 * 覆盖核心业务规则：主体/组织存在校验、跨租户越权防护、重复成员关系拦截
 */
@ExtendWith(MockitoExtension.class)
class MembershipServiceTest {

    @Mock
    private MembershipRepository membershipRepository;

    @Mock
    private PrincipalRepository principalRepository;

    @Mock
    private OrganizationRepository organizationRepository;

    private MembershipService service;

    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID otherTenantId = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private final UUID principalId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final UUID organizationId = UUID.fromString("44444444-4444-4444-4444-444444444444");
    private final UUID membershipId = UUID.fromString("55555555-5555-5555-5555-555555555555");

    @BeforeEach
    void setUp() {
        service = new MembershipService(membershipRepository, principalRepository, organizationRepository);
    }

    @Nested
    @DisplayName("创建成员关系")
    class CreateMembership {

        @Test
        @DisplayName("应该在主体不存在时抛出业务异常")
        void shouldThrowWhenPrincipalNotFound() {
            when(principalRepository.findById(principalId)).thenReturn(Optional.empty());

            CreateMembershipRequest request = new CreateMembershipRequest(
                    principalId, organizationId, "MEMBER", null, null);

            assertThatThrownBy(() -> service.createMembership(tenantId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.PRINCIPAL_NOT_FOUND);
        }

        @Test
        @DisplayName("应该在主体属于其他租户时抛出业务异常（越权防护）")
        void shouldThrowWhenPrincipalBelongsToOtherTenant() {
            Principal principal = new Principal();
            principal.setId(principalId);
            principal.setTenantId(otherTenantId);
            when(principalRepository.findById(principalId)).thenReturn(Optional.of(principal));

            CreateMembershipRequest request = new CreateMembershipRequest(
                    principalId, organizationId, "MEMBER", null, null);

            assertThatThrownBy(() -> service.createMembership(tenantId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.PRINCIPAL_NOT_FOUND);
        }

        @Test
        @DisplayName("应该在组织不存在时抛出业务异常")
        void shouldThrowWhenOrganizationNotFound() {
            stubPrincipalInTenant();

            when(organizationRepository.findById(organizationId)).thenReturn(Optional.empty());

            CreateMembershipRequest request = new CreateMembershipRequest(
                    principalId, organizationId, "MEMBER", null, null);

            assertThatThrownBy(() -> service.createMembership(tenantId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.ORGANIZATION_NOT_FOUND);
        }

        @Test
        @DisplayName("应该在组织属于其他租户时抛出业务异常（越权防护）")
        void shouldThrowWhenOrganizationBelongsToOtherTenant() {
            stubPrincipalInTenant();

            Organization org = new Organization();
            org.setId(organizationId);
            org.setTenantId(otherTenantId);
            when(organizationRepository.findById(organizationId)).thenReturn(Optional.of(org));

            CreateMembershipRequest request = new CreateMembershipRequest(
                    principalId, organizationId, "MEMBER", null, null);

            assertThatThrownBy(() -> service.createMembership(tenantId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.ORGANIZATION_NOT_FOUND);
        }

        @Test
        @DisplayName("应该在同主体-组织已有 ACTIVE 关系时抛出业务异常")
        void shouldThrowWhenDuplicateMembershipExists() {
            stubPrincipalInTenant();
            stubOrganizationInTenant();

            Membership existing = new Membership();
            existing.setId(UUID.randomUUID());
            existing.setTenantId(tenantId);
            existing.setPrincipalId(principalId);
            existing.setOrganizationId(organizationId);
            existing.setStatus("ACTIVE");
            when(membershipRepository.findByTenantIdAndPrincipalIdAndStatus(tenantId, principalId, "ACTIVE"))
                    .thenReturn(List.of(existing));

            CreateMembershipRequest request = new CreateMembershipRequest(
                    principalId, organizationId, "MEMBER", null, null);

            assertThatThrownBy(() -> service.createMembership(tenantId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.MEMBERSHIP_ALREADY_EXISTS);
        }

        @Test
        @DisplayName("应该成功创建成员关系并写入关键字段")
        void shouldCreateMembershipSuccessfully() {
            stubPrincipalInTenant();
            stubOrganizationInTenant();
            when(membershipRepository.findByTenantIdAndPrincipalIdAndStatus(tenantId, principalId, "ACTIVE"))
                    .thenReturn(List.of());

            Instant effectiveFrom = Instant.parse("2026-01-01T00:00:00Z");
            Instant effectiveTo = Instant.parse("2026-12-31T23:59:59Z");

            Membership saved = buildSavedMembership();
            saved.setRole("OWNER");
            saved.setEffectiveFrom(effectiveFrom);
            saved.setEffectiveTo(effectiveTo);
            when(membershipRepository.save(any(Membership.class))).thenReturn(saved);

            CreateMembershipRequest request = new CreateMembershipRequest(
                    principalId, organizationId, "OWNER", effectiveFrom, effectiveTo);

            MembershipDto dto = service.createMembership(tenantId, request);

            assertThat(dto.id()).isEqualTo(membershipId);
            assertThat(dto.tenantId()).isEqualTo(tenantId);
            assertThat(dto.principalId()).isEqualTo(principalId);
            assertThat(dto.organizationId()).isEqualTo(organizationId);
            assertThat(dto.role()).isEqualTo("OWNER");
            assertThat(dto.status()).isEqualTo("ACTIVE");
            assertThat(dto.effectiveFrom()).isEqualTo(effectiveFrom);
            assertThat(dto.effectiveTo()).isEqualTo(effectiveTo);

            ArgumentCaptor<Membership> captor = ArgumentCaptor.forClass(Membership.class);
            verify(membershipRepository).save(captor.capture());
            Membership captured = captor.getValue();
            assertThat(captured.getTenantId()).isEqualTo(tenantId);
            assertThat(captured.getPrincipalId()).isEqualTo(principalId);
            assertThat(captured.getOrganizationId()).isEqualTo(organizationId);
            assertThat(captured.getRole()).isEqualTo("OWNER");
            assertThat(captured.getStatus()).isEqualTo("ACTIVE");
        }
    }

    @Nested
    @DisplayName("查询成员关系")
    class GetMembership {

        @Test
        @DisplayName("应该成功查询成员关系")
        void shouldGetMembershipSuccessfully() {
            Membership membership = buildSavedMembership();
            when(membershipRepository.findById(membershipId)).thenReturn(Optional.of(membership));

            MembershipDto dto = service.getMembership(tenantId, membershipId);

            assertThat(dto.id()).isEqualTo(membershipId);
            assertThat(dto.tenantId()).isEqualTo(tenantId);
            assertThat(dto.principalId()).isEqualTo(principalId);
            assertThat(dto.organizationId()).isEqualTo(organizationId);
        }

        @Test
        @DisplayName("应该在成员关系不存在时抛出业务异常")
        void shouldThrowWhenMembershipNotFound() {
            when(membershipRepository.findById(membershipId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getMembership(tenantId, membershipId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
        }

        @Test
        @DisplayName("应该在成员关系属于其他租户时抛出业务异常（越权防护）")
        void shouldThrowWhenMembershipBelongsToOtherTenant() {
            Membership membership = buildSavedMembership();
            membership.setTenantId(otherTenantId);
            when(membershipRepository.findById(membershipId)).thenReturn(Optional.of(membership));

            assertThatThrownBy(() -> service.getMembership(tenantId, membershipId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
        }
    }

    @Nested
    @DisplayName("按主体查询成员关系列表")
    class ListByPrincipal {

        @Test
        @DisplayName("应该返回该主体在租户内的全部 ACTIVE 关系")
        void shouldReturnActiveMembershipsForPrincipal() {
            Membership m1 = buildSavedMembership();
            m1.setId(UUID.randomUUID());
            Membership m2 = buildSavedMembership();
            m2.setId(UUID.randomUUID());

            when(membershipRepository.findByTenantIdAndPrincipalIdAndStatus(tenantId, principalId, "ACTIVE"))
                    .thenReturn(List.of(m1, m2));

            List<MembershipDto> result = service.listByPrincipal(tenantId, principalId);

            assertThat(result).hasSize(2);
            assertThat(result).allSatisfy(dto -> {
                assertThat(dto.tenantId()).isEqualTo(tenantId);
                assertThat(dto.principalId()).isEqualTo(principalId);
                assertThat(dto.status()).isEqualTo("ACTIVE");
            });

            verify(membershipRepository).findByTenantIdAndPrincipalIdAndStatus(tenantId, principalId, "ACTIVE");
        }

        @Test
        @DisplayName("主体无成员关系时应返回空列表")
        void shouldReturnEmptyListWhenNoMemberships() {
            when(membershipRepository.findByTenantIdAndPrincipalIdAndStatus(tenantId, principalId, "ACTIVE"))
                    .thenReturn(List.of());

            List<MembershipDto> result = service.listByPrincipal(tenantId, principalId);

            assertThat(result).isEmpty();
        }
    }

    // ── 测试辅助方法 ──────────────────────────────────────────

    private void stubPrincipalInTenant() {
        Principal principal = new Principal();
        principal.setId(principalId);
        principal.setTenantId(tenantId);
        when(principalRepository.findById(principalId)).thenReturn(Optional.of(principal));
    }

    private void stubOrganizationInTenant() {
        Organization org = new Organization();
        org.setId(organizationId);
        org.setTenantId(tenantId);
        when(organizationRepository.findById(organizationId)).thenReturn(Optional.of(org));
    }

    private Membership buildSavedMembership() {
        Membership membership = new Membership();
        membership.setId(membershipId);
        membership.setTenantId(tenantId);
        membership.setPrincipalId(principalId);
        membership.setOrganizationId(organizationId);
        membership.setRole("MEMBER");
        membership.setStatus("ACTIVE");
        membership.setJoinedAt(Instant.parse("2026-01-01T00:00:00Z"));
        return membership;
    }
}
