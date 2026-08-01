package com.platform.core.change.request.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.platform.core.common.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;

/**
 * AI 辅助影响分析（Sprint V1.8）
 *
 * <p>调用 AI Service 的 text-generation 端点，基于变更请求基本信息自动生成影响分析草稿。
 * 响应包含 requiresHumanReview=true / isAiAssisted=true 标记，确保人工复核（设计安全红线）。
 *
 * <p>调用链：ChangeRequestService.submitImpactAssessment
 *           → AiImpactAnalyzer.generateImpactAnalysis
 *           → POST {aiService.baseUrl}/api/v1/capabilities/text-generation
 *           → 返回结构化 JSON（含 summary / affectedAreas / suggestedActions 字段）
 *
 * <p>降级策略：AI 调用失败（超时、网络异常、5xx）不阻断主流程，保留手动输入的 impactAssessment，
 * 同时在 aiAssistedAnalysis 中记录降级原因，供前端展示「AI 不可用，使用手动输入」。
 *
 * @design D37-关键界面-交互状态.md §D37.16 P12 变更影响与闭环工作台
 * @design security.md §12 AI 安全红线（requiresHumanReview 强制为 true）
 */
@Component
public class AiImpactAnalyzer {

    private static final Logger log = LoggerFactory.getLogger(AiImpactAnalyzer.class);

    /** 系统提示词：约束 LLM 输出结构化、可复核的影响分析 */
    private static final String SYSTEM_PROMPT = """
            你是建筑工程变更影响分析专家。基于变更请求信息，输出结构化 JSON 影响分析，字段：
            - summary：变更摘要（≤200 字）
            - affectedAreas：受影响专业/模块列表（如 [建筑, 结构, MEP]）
            - riskLevel：风险等级（LOW/MEDIUM/HIGH/CRITICAL）
            - suggestedActions：建议后续动作列表
            - reviewNotes：人工复核要点

            严格只输出 JSON 对象，不要附加解释。所有内容必须中文。""";

    private final RestClient aiRestClient;
    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;

    public AiImpactAnalyzer(
            RestClient aiRestClient,
            AppProperties appProperties,
            ObjectMapper objectMapper
    ) {
        this.aiRestClient = aiRestClient;
        this.appProperties = appProperties;
        this.objectMapper = objectMapper;
    }

    /**
     * 调用 AI 生成影响分析
     *
     * @param changeRequest 变更请求实体（用于构建 prompt）
     * @param traceId       追踪 ID（写入 x-trace-id header）
     * @return JSON 字符串（含 content 字段为 LLM 输出，isAiAssisted=true，requiresHumanReview=true）
     */
    public AnalysisResult generateImpactAnalysis(
            com.platform.core.change.request.domain.ChangeRequest changeRequest,
            String traceId
    ) {
        String prompt = buildPrompt(changeRequest);
        String endpoint = appProperties.getAiService().getBaseUrl() + "/api/v1/capabilities/text-generation";

        try {
            log.info("AI 影响分析请求: changeId={}, traceId={}, endpoint={}",
                    changeRequest.getId(), traceId, endpoint);

            JsonNode response = aiRestClient.post()
                    .uri(endpoint)
                    .header("Content-Type", "application/json")
                    .header("x-trace-id", traceId == null ? "" : traceId)
                    .body(Map.of(
                            "prompt", prompt,
                            "system", SYSTEM_PROMPT,
                            "maxTokens", 1024,
                            "temperature", 0.3
                    ))
                    .retrieve()
                    .body(JsonNode.class);

            return parseResponse(response);
        } catch (Exception ex) {
            log.warn("AI 影响分析失败，降级使用手动输入: changeId={}, reason={}",
                    changeRequest.getId(), ex.getMessage());
            return degradedResult(ex.getMessage());
        }
    }

    /** 构建调用 AI 的 prompt（包含变更请求关键信息） */
    private String buildPrompt(com.platform.core.change.request.domain.ChangeRequest cr) {
        return """
                请基于以下变更请求生成影响分析：

                变更编号：%s
                变更标题：%s
                变更类型：%s
                优先级：%s
                变更描述：%s
                风险评估：%s

                输出严格 JSON 格式的影响分析。""".formatted(
                nullSafe(cr.getCode()),
                nullSafe(cr.getTitle()),
                cr.getType() == null ? "UNKNOWN" : cr.getType(),
                cr.getPriority() == null ? "UNKNOWN" : cr.getPriority(),
                nullSafe(cr.getDescription()),
                nullSafe(cr.getRiskAssessment())
        );
    }

    /** 解析 AI Service 响应 */
    private AnalysisResult parseResponse(JsonNode response) {
        if (response == null) {
            return degradedResult("AI 返回空响应");
        }
        String content = response.path("content").asText("");
        if (content.isBlank()) {
            return degradedResult("AI 响应 content 字段为空");
        }
        boolean requiresReview = response.path("requiresHumanReview").asBoolean(true);
        boolean aiAssisted = response.path("isAiAssisted").asBoolean(true);
        String model = response.path("model").asText("unknown");

        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("content", content);
        payload.put("model", model);
        payload.put("requiresHumanReview", requiresReview);
        payload.put("generatedAt", java.time.Instant.now().toString());

        log.info("AI 影响分析成功: model={}, contentLength={}, requiresReview={}",
                model, content.length(), requiresReview);
        return new AnalysisResult(payload.toString(), aiAssisted, requiresReview, null);
    }

    /** 降级结果（AI 调用失败时使用） */
    private AnalysisResult degradedResult(String reason) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("degraded", true);
        payload.put("reason", reason == null ? "unknown" : reason);
        payload.put("generatedAt", java.time.Instant.now().toString());
        return new AnalysisResult(payload.toString(), false, true, reason);
    }

    private String nullSafe(String s) {
        return s == null ? "" : s;
    }

    /**
     * AI 分析结果
     *
     * @param payload             JSON 字符串（写入 change_request.ai_assisted_analysis）
     * @param aiAssisted          是否 AI 辅助（失败降级时为 false）
     * @param requiresHumanReview 是否强制人工复核（默认 true，设计安全红线）
     * @param degradeReason       降级原因（成功时为 null）
     */
    public record AnalysisResult(
            String payload,
            boolean aiAssisted,
            boolean requiresHumanReview,
            String degradeReason
    ) {}
}
