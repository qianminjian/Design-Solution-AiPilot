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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * 成员关系应用服务
 */
@Service
public class MembershipService {

    private static final Logger log = LoggerFactory.getLogger(MembershipService.class);

    private final MembershipRepository membershipRepository;
    private final PrincipalRepository principalRepository;
    private final OrganizationRepository organizationRepository;

    public MembershipService(MembershipRepository membershipRepository,
                             PrincipalRepository principalRepository,
                             OrganizationRepository organizationRepository) {
        this.membershipRepository = membershipRepository;
        this.principalRepository = principalRepository;
        this.organizationRepository = organizationRepository;
    }

    /**
     * 创建成员关系
     * 业务规则：
     * 1. 主体必须存在且同租户
     * 2. 组织必须存在且同租户
     * 3. 同主体-组织重复 ACTIVE 关系不允许
     */
    @Transactional
    public MembershipDto createMembership(UUID tenantId, CreateMembershipRequest request) {
        validatePrincipalExists(tenantId, request.principalId());
        validateOrganizationExists(tenantId, request.organizationId());
        validateNoDuplicateMembership(tenantId, request.principalId(), request.organizationId());

        Membership membership = new Membership();
        membership.setTenantId(tenantId);
        membership.setPrincipalId(request.principalId());
        membership.setOrganizationId(request.organizationId());
        membership.setRole(request.role());
        membership.setStatus("ACTIVE");
        membership.setEffectiveFrom(request.effectiveFrom());
        membership.setEffectiveTo(request.effectiveTo());

        Membership saved = membershipRepository.save(membership);
        log.info("创建成员关系成功 tenantId={} principalId={} orgId={}",
                tenantId, request.principalId(), request.organizationId());
        return toDto(saved);
    }

    /**
     * 按 ID 查询成员关系
     */
    @Transactional(readOnly = true)
    public MembershipDto getMembership(UUID tenantId, UUID membershipId) {
        Membership membership = loadMembershipOrThrow(tenantId, membershipId);
        return toDto(membership);
    }

    /**
     * 按主体查询成员关系列表
     */
    @Transactional(readOnly = true)
    public List<MembershipDto> listByPrincipal(UUID tenantId, UUID principalId) {
        return membershipRepository
                .findByTenantIdAndPrincipalIdAndStatus(tenantId, principalId, "ACTIVE")
                .stream()
                .map(this::toDto)
                .toList();
    }

    /**
     * 校验主体存在且同租户
     */
    private void validatePrincipalExists(UUID tenantId, UUID principalId) {
        principalRepository.findById(principalId)
                .filter(p -> tenantId.equals(p.getTenantId()))
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.PRINCIPAL_NOT_FOUND,
                        "主体不存在: " + principalId));
    }

    /**
     * 校验组织存在且同租户
     */
    private void validateOrganizationExists(UUID tenantId, UUID organizationId) {
        organizationRepository.findById(organizationId)
                .filter(o -> tenantId.equals(o.getTenantId()))
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.ORGANIZATION_NOT_FOUND,
                        "组织不存在: " + organizationId));
    }

    /**
     * 校验同主体-组织 ACTIVE 关系唯一
     */
    private void validateNoDuplicateMembership(UUID tenantId, UUID principalId, UUID organizationId) {
        boolean exists = membershipRepository
                .findByTenantIdAndPrincipalIdAndStatus(tenantId, principalId, "ACTIVE")
                .stream()
                .anyMatch(m -> organizationId.equals(m.getOrganizationId()));
        if (exists) {
            throw new BusinessException(
                    ErrorCode.MEMBERSHIP_ALREADY_EXISTS,
                    "成员关系已存在: principal=" + principalId + ", org=" + organizationId);
        }
    }

    /**
     * 加载成员关系（带租户校验，防越权）
     */
    private Membership loadMembershipOrThrow(UUID tenantId, UUID membershipId) {
        return membershipRepository.findById(membershipId)
                .filter(m -> tenantId.equals(m.getTenantId()))
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        "成员关系不存在: " + membershipId));
    }

    /**
     * 实体 → DTO
     */
    private MembershipDto toDto(Membership m) {
        return new MembershipDto(
                m.getId(),
                m.getTenantId(),
                m.getPrincipalId(),
                m.getOrganizationId(),
                m.getRole(),
                m.getStatus(),
                m.getJoinedAt(),
                m.getEffectiveFrom(),
                m.getEffectiveTo(),
                m.getCreatedAt(),
                m.getUpdatedAt(),
                m.getRowVersion()
        );
    }
}
