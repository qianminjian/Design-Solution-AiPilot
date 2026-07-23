package com.platform.core.compliance.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.compliance.domain.ComplianceRuleSet;
import com.platform.core.compliance.domain.RuleSetRule;
import com.platform.core.compliance.dto.ComplianceRuleSetDto;
import com.platform.core.compliance.dto.CreateRuleSetRequest;
import com.platform.core.compliance.repository.ComplianceRuleSetRepository;
import com.platform.core.compliance.repository.RuleSetRuleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class RuleSetService {

    private static final Logger log = LoggerFactory.getLogger(RuleSetService.class);

    private final ComplianceRuleSetRepository ruleSetRepository;
    private final RuleSetRuleRepository ruleSetRuleRepository;

    public RuleSetService(ComplianceRuleSetRepository ruleSetRepository,
                          RuleSetRuleRepository ruleSetRuleRepository) {
        this.ruleSetRepository = ruleSetRepository;
        this.ruleSetRuleRepository = ruleSetRuleRepository;
    }

    @Transactional
    public ComplianceRuleSetDto createRuleSet(UUID tenantId, CreateRuleSetRequest request) {
        if (ruleSetRepository.existsByTenantIdAndName(tenantId, request.name())) {
            throw new BusinessException(ErrorCode.RULE_SET_NAME_ALREADY_EXISTS,
                    "规则集名称在租户内已存在: " + request.name());
        }

        ComplianceRuleSet ruleSet = new ComplianceRuleSet();
        ruleSet.setTenantId(tenantId);
        ruleSet.setName(request.name());
        ruleSet.setDescription(request.description());
        ruleSet.setStageCode(request.stageCode());
        ruleSet.setStatus("DRAFT");

        ComplianceRuleSet saved = ruleSetRepository.save(ruleSet);
        log.info("创建规则集成功 tenantId={} ruleSetId={} name={}", tenantId, saved.getId(), saved.getName());

        if (request.rules() != null && !request.rules().isEmpty()) {
            for (CreateRuleSetRequest.RuleSetRuleEntry entry : request.rules()) {
                RuleSetRule rsr = new RuleSetRule();
                rsr.setRuleSetId(saved.getId());
                rsr.setRevisionId(entry.revisionId());
                rsr.setPriority(entry.priority() != null ? entry.priority() : 1);
                ruleSetRuleRepository.save(rsr);
            }
            log.info("添加规则到规则集 tenantId={} ruleSetId={} ruleCount={}", tenantId, saved.getId(), request.rules().size());
        }

        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public ComplianceRuleSetDto getRuleSet(UUID tenantId, UUID ruleSetId) {
        return toDto(loadRuleSetOrThrow(tenantId, ruleSetId));
    }

    @Transactional(readOnly = true)
    public Page<ComplianceRuleSetDto> listRuleSets(UUID tenantId, String stageCode, String status, Pageable pageable) {
        Page<ComplianceRuleSet> page;
        if (stageCode != null && !stageCode.isBlank()) {
            page = ruleSetRepository.findByTenantIdAndStageCode(tenantId, stageCode, pageable);
        } else if (status != null && !status.isBlank()) {
            page = ruleSetRepository.findByTenantIdAndStatus(tenantId, status, pageable);
        } else {
            page = ruleSetRepository.findByTenantId(tenantId, pageable);
        }
        return page.map(this::toDto);
    }

    @Transactional
    public void deleteRuleSet(UUID tenantId, UUID ruleSetId) {
        ComplianceRuleSet ruleSet = loadRuleSetOrThrow(tenantId, ruleSetId);
        ruleSet.setDeletedAt(java.time.Instant.now());
        ruleSetRepository.save(ruleSet);
        log.info("软删除规则集成功 tenantId={} ruleSetId={}", tenantId, ruleSetId);
    }

    @Transactional
    public ComplianceRuleSetDto addRulesToRuleSet(UUID tenantId, UUID ruleSetId, List<CreateRuleSetRequest.RuleSetRuleEntry> entries) {
        loadRuleSetOrThrow(tenantId, ruleSetId);

        for (CreateRuleSetRequest.RuleSetRuleEntry entry : entries) {
            if (!ruleSetRuleRepository.existsByRuleSetIdAndRevisionId(ruleSetId, entry.revisionId())) {
                RuleSetRule rsr = new RuleSetRule();
                rsr.setRuleSetId(ruleSetId);
                rsr.setRevisionId(entry.revisionId());
                rsr.setPriority(entry.priority() != null ? entry.priority() : 1);
                ruleSetRuleRepository.save(rsr);
            }
        }

        return toDto(ruleSetRepository.findById(ruleSetId).orElseThrow());
    }

    @Transactional
    public ComplianceRuleSetDto removeRuleFromRuleSet(UUID tenantId, UUID ruleSetId, UUID revisionId) {
        loadRuleSetOrThrow(tenantId, ruleSetId);
        ruleSetRuleRepository.findByRuleSetId(ruleSetId).stream()
                .filter(rsr -> rsr.getRevisionId().equals(revisionId))
                .findFirst()
                .ifPresent(ruleSetRuleRepository::delete);
        return toDto(ruleSetRepository.findById(ruleSetId).orElseThrow());
    }

    private ComplianceRuleSet loadRuleSetOrThrow(UUID tenantId, UUID ruleSetId) {
        return ruleSetRepository.findByIdAndTenantId(ruleSetId, tenantId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RULE_SET_NOT_FOUND, "规则集不存在: " + ruleSetId));
    }

    private ComplianceRuleSetDto toDto(ComplianceRuleSet rs) {
        List<ComplianceRuleSetDto.RuleSetRuleDto> rules = ruleSetRuleRepository
                .findByRuleSetIdOrderByPriorityAsc(rs.getId())
                .stream()
                .map(r -> new ComplianceRuleSetDto.RuleSetRuleDto(r.getRevisionId(), r.getPriority()))
                .toList();

        return new ComplianceRuleSetDto(
                rs.getId(),
                rs.getTenantId(),
                rs.getName(),
                rs.getDescription(),
                rs.getStageCode(),
                rs.getStatus(),
                rules,
                rs.getCreatedAt(),
                rs.getUpdatedAt(),
                rs.getCreatedBy(),
                rs.getUpdatedBy(),
                rs.getRowVersion()
        );
    }
}