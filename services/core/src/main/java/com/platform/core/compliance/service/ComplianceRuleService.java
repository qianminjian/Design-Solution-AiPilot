package com.platform.core.compliance.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.compliance.domain.ComplianceRule;
import com.platform.core.compliance.domain.RuleRevision;
import com.platform.core.compliance.dto.ComplianceRuleDto;
import com.platform.core.compliance.dto.CreateRuleRequest;
import com.platform.core.compliance.dto.CreateRuleRevisionRequest;
import com.platform.core.compliance.dto.IdsImportResponse;
import com.platform.core.compliance.dto.RuleRevisionDto;
import com.platform.core.compliance.dto.UpdateRuleRequest;
import com.platform.core.compliance.ids.IdsParser;
import com.platform.core.compliance.ids.IdsRuleConverter;
import com.platform.core.compliance.ids.model.IdsSpecification;
import com.platform.core.compliance.repository.ComplianceRuleRepository;
import com.platform.core.compliance.repository.RuleRevisionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ComplianceRuleService {

    private static final Logger log = LoggerFactory.getLogger(ComplianceRuleService.class);

    private final ComplianceRuleRepository ruleRepository;
    private final RuleRevisionRepository revisionRepository;
    private final ObjectMapper objectMapper;
    private final IdsParser idsParser;
    private final IdsRuleConverter idsRuleConverter;

    public ComplianceRuleService(ComplianceRuleRepository ruleRepository,
                                 RuleRevisionRepository revisionRepository,
                                 ObjectMapper objectMapper,
                                 IdsParser idsParser,
                                 IdsRuleConverter idsRuleConverter) {
        this.ruleRepository = ruleRepository;
        this.revisionRepository = revisionRepository;
        this.objectMapper = objectMapper;
        this.idsParser = idsParser;
        this.idsRuleConverter = idsRuleConverter;
    }

    @Transactional
    public ComplianceRuleDto createRule(UUID tenantId, CreateRuleRequest request) {
        if (ruleRepository.existsByTenantIdAndRuleCode(tenantId, request.ruleCode())) {
            throw new BusinessException(ErrorCode.RULE_CODE_ALREADY_EXISTS,
                    "规则编码在租户内已存在: " + request.ruleCode());
        }

        ComplianceRule rule = new ComplianceRule();
        rule.setTenantId(tenantId);
        rule.setRuleCode(request.ruleCode());
        rule.setName(request.name());
        rule.setCategory(request.category());
        rule.setOwner(request.owner());
        rule.setDescription(request.description());
        rule.setBasis(serializeJson(request.basis()));
        rule.setStatus("CANDIDATE");

        ComplianceRule saved = ruleRepository.save(rule);
        log.info("创建规则成功 tenantId={} ruleId={} ruleCode={}", tenantId, saved.getId(), saved.getRuleCode());
        return toRuleDto(saved);
    }

    @Transactional(readOnly = true)
    public ComplianceRuleDto getRule(UUID tenantId, UUID ruleId) {
        return toRuleDto(loadRuleOrThrow(tenantId, ruleId));
    }

    @Transactional(readOnly = true)
    public Page<ComplianceRuleDto> listRules(UUID tenantId, String category, String status, Pageable pageable) {
        Page<ComplianceRule> page;
        if (category != null && !category.isBlank()) {
            page = ruleRepository.findByTenantIdAndCategory(tenantId, category, pageable);
        } else if (status != null && !status.isBlank()) {
            page = ruleRepository.findByTenantIdAndStatus(tenantId, status, pageable);
        } else {
            page = ruleRepository.findByTenantId(tenantId, pageable);
        }
        return page.map(this::toRuleDto);
    }

    @Transactional
    public ComplianceRuleDto updateRule(UUID tenantId, UUID ruleId, UpdateRuleRequest request) {
        ComplianceRule rule = loadRuleOrThrow(tenantId, ruleId);

        if (request.name() != null) {
            rule.setName(request.name());
        }
        if (request.category() != null) {
            rule.setCategory(request.category());
        }
        if (request.owner() != null) {
            rule.setOwner(request.owner());
        }
        if (request.description() != null) {
            rule.setDescription(request.description());
        }
        if (request.basis() != null) {
            rule.setBasis(serializeJson(request.basis()));
        }
        if (request.status() != null) {
            rule.setStatus(request.status());
        }

        ComplianceRule saved = ruleRepository.save(rule);
        log.info("更新规则成功 tenantId={} ruleId={}", tenantId, ruleId);
        return toRuleDto(saved);
    }

    @Transactional
    public void deleteRule(UUID tenantId, UUID ruleId) {
        ComplianceRule rule = loadRuleOrThrow(tenantId, ruleId);
        rule.setDeletedAt(java.time.Instant.now());
        ruleRepository.save(rule);
        log.info("软删除规则成功 tenantId={} ruleId={}", tenantId, ruleId);
    }

    @Transactional
    public RuleRevisionDto createRevision(UUID tenantId, UUID ruleId, CreateRuleRevisionRequest request) {
        ComplianceRule rule = loadRuleOrThrow(tenantId, ruleId);

        Long nextRevisionNo = revisionRepository.countByRuleId(ruleId) + 1;

        RuleRevision revision = new RuleRevision();
        revision.setTenantId(tenantId);
        revision.setRuleId(ruleId);
        revision.setRevisionNo(nextRevisionNo);
        revision.setDslJson(request.dslJson());
        revision.setParametersJson(serializeJson(request.parametersJson()));
        revision.setBasis(serializeJson(request.basis()));
        revision.setEngineProfile(request.engineProfile());
        revision.setStatus("DRAFT");

        RuleRevision saved = revisionRepository.save(revision);
        log.info("创建规则版本成功 tenantId={} ruleId={} revisionNo={}", tenantId, ruleId, nextRevisionNo);
        return toRevisionDto(saved);
    }

    @Transactional(readOnly = true)
    public RuleRevisionDto getRevision(UUID tenantId, UUID revisionId) {
        RuleRevision revision = revisionRepository.findByIdAndTenantId(revisionId, tenantId)
                .orElseThrow(() -> new BusinessException(ErrorCode.REVISION_NOT_FOUND,
                        "规则版本不存在: " + revisionId));
        return toRevisionDto(revision);
    }

    @Transactional(readOnly = true)
    public Page<RuleRevisionDto> listRevisions(UUID tenantId, UUID ruleId, Pageable pageable) {
        Page<RuleRevision> page = revisionRepository.findByRuleId(ruleId, pageable);
        return page.map(this::toRevisionDto);
    }

    @Transactional
    public RuleRevisionDto activateRevision(UUID tenantId, UUID revisionId) {
        RuleRevision revision = revisionRepository.findByIdAndTenantId(revisionId, tenantId)
                .orElseThrow(() -> new BusinessException(ErrorCode.REVISION_NOT_FOUND,
                        "规则版本不存在: " + revisionId));

        if (!"APPROVED".equals(revision.getStatus())) {
            throw new BusinessException(ErrorCode.RULE_NOT_APPROVED, "规则版本未批准，无法激活");
        }

        revision.setStatus("ACTIVE");
        RuleRevision saved = revisionRepository.save(revision);
        log.info("激活规则版本成功 tenantId={} revisionId={}", tenantId, revisionId);
        return toRevisionDto(saved);
    }

    @Transactional
    public IdsImportResponse importFromIds(UUID tenantId, String xmlContent) {
        log.info("开始导入 IDS 规则 tenantId={}", tenantId);
        
        IdsSpecification specification = idsParser.parse(xmlContent);
        List<IdsRuleConverter.ConvertResult> convertResults = idsRuleConverter.convert(specification);
        
        List<IdsImportResponse.ImportedRule> importedRules = new java.util.ArrayList<>();
        int skippedCount = 0;
        
        for (IdsRuleConverter.ConvertResult result : convertResults) {
            try {
                if (ruleRepository.existsByTenantIdAndRuleCode(tenantId, result.ruleCode())) {
                    skippedCount++;
                    log.warn("规则编码已存在，跳过导入: {}", result.ruleCode());
                    continue;
                }
                
                ComplianceRuleDto ruleDto = createRule(tenantId, result.ruleRequest());
                RuleRevisionDto revisionDto = createRevision(tenantId, ruleDto.id(), result.revisionRequest());
                
                importedRules.add(new IdsImportResponse.ImportedRule(
                        ruleDto.id(),
                        result.ruleCode(),
                        ruleDto.name(),
                        revisionDto.id(),
                        revisionDto.revisionNo(),
                        revisionDto.status()
                ));
                
                log.info("导入 IDS 规则成功 tenantId={} ruleCode={} ruleId={}", 
                        tenantId, result.ruleCode(), ruleDto.id());
            } catch (Exception e) {
                skippedCount++;
                log.error("导入 IDS 规则失败 ruleCode={}: {}", result.ruleCode(), e.getMessage());
            }
        }
        
        log.info("IDS 规则导入完成 tenantId={} total={} imported={} skipped={}", 
                tenantId, convertResults.size(), importedRules.size(), skippedCount);
        
        return new IdsImportResponse(
                specification.getTitle(),
                specification.getVersion(),
                convertResults.size(),
                importedRules.size(),
                skippedCount,
                importedRules
        );
    }

    private ComplianceRule loadRuleOrThrow(UUID tenantId, UUID ruleId) {
        return ruleRepository.findByIdAndTenantId(ruleId, tenantId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RULE_NOT_FOUND, "规则不存在: " + ruleId));
    }

    private String serializeJson(Map<String, Object> data) {
        if (data == null || data.isEmpty()) {
            return "{}";
        }
        try {
            return objectMapper.writeValueAsString(data);
        } catch (JsonProcessingException ex) {
            log.error("JSON 序列化失败", ex);
            throw new BusinessException(ErrorCode.PARAM_INVALID, "JSON 序列化失败");
        }
    }

    private ComplianceRuleDto toRuleDto(ComplianceRule r) {
        return new ComplianceRuleDto(
                r.getId(),
                r.getTenantId(),
                r.getRuleCode(),
                r.getName(),
                r.getCategory(),
                r.getOwner(),
                r.getStatus(),
                r.getDescription(),
                r.getBasis(),
                r.getCreatedAt(),
                r.getUpdatedAt(),
                r.getCreatedBy(),
                r.getUpdatedBy(),
                r.getRowVersion()
        );
    }

    private RuleRevisionDto toRevisionDto(RuleRevision rev) {
        return new RuleRevisionDto(
                rev.getId(),
                rev.getTenantId(),
                rev.getRuleId(),
                rev.getRevisionNo(),
                rev.getDslJson(),
                rev.getParametersJson(),
                rev.getBasis(),
                rev.getEngineProfile(),
                rev.getStatus(),
                rev.getCreatedAt(),
                rev.getCreatedBy(),
                rev.getRowVersion()
        );
    }
}