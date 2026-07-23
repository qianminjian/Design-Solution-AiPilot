package com.platform.core.compliance.ids;

import com.platform.core.compliance.ids.model.IdsApplicability;
import com.platform.core.compliance.ids.model.IdsRequirement;
import com.platform.core.compliance.ids.model.IdsRule;
import com.platform.core.compliance.ids.model.IdsSpecification;
import com.platform.core.compliance.dto.CreateRuleRequest;
import com.platform.core.compliance.dto.CreateRuleRevisionRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class IdsRuleConverter {

    private static final Logger log = LoggerFactory.getLogger(IdsRuleConverter.class);

    public List<ConvertResult> convert(IdsSpecification specification) {
        List<ConvertResult> results = new ArrayList<>();
        
        int ruleIndex = 1;
        for (IdsRule idsRule : specification.getRules()) {
            String ruleCode = generateRuleCode(specification.getTitle(), ruleIndex++);
            CreateRuleRequest ruleRequest = toRuleRequest(idsRule, ruleCode, specification);
            CreateRuleRevisionRequest revisionRequest = toRevisionRequest(idsRule, specification);
            results.add(new ConvertResult(ruleCode, ruleRequest, revisionRequest));
        }
        
        log.info("IDS 规则转换完成: 共 {} 条规则", results.size());
        return results;
    }

    String generateRuleCode(String title, int index) {
        String prefix;
        if (title != null && !title.isBlank()) {
            String[] words = title.toUpperCase().split("[^A-Za-z]+");
            StringBuilder sb = new StringBuilder();
            for (String word : words) {
                if (!word.isEmpty()) {
                    sb.append(word);
                }
            }
            prefix = sb.length() > 0 ? sb.toString() : "IDS";
        } else {
            prefix = "IDS";
        }
        if (prefix.length() > 15) {
            prefix = prefix.substring(0, 15);
        }
        return prefix + "-" + String.format("%04d", index);
    }

    private CreateRuleRequest toRuleRequest(IdsRule idsRule, String ruleCode, IdsSpecification spec) {
        String category = determineCategory(idsRule);
        
        Map<String, Object> basis = new LinkedHashMap<>();
        basis.put("source", "IDS");
        basis.put("idsVersion", spec.getVersion());
        basis.put("idsTitle", spec.getTitle());
        if (spec.getAuthor() != null) {
            basis.put("idsAuthor", spec.getAuthor());
        }
        
        return new CreateRuleRequest(
                ruleCode,
                idsRule.getName(),
                category,
                null,
                idsRule.getDescription(),
                basis
        );
    }

    String determineCategory(IdsRule idsRule) {
        IdsApplicability app = idsRule.getApplicability();
        if (app == null) {
            return "INFORMATION";
        }
        
        if (app.getEntityType() != null) {
            String entityType = app.getEntityType().toUpperCase();
            if (entityType.contains("WALL") || entityType.contains("FLOOR") || 
                entityType.contains("CEILING") || entityType.contains("ROOF")) {
                return "GEOMETRY";
            }
            if (entityType.contains("DOOR") || entityType.contains("WINDOW") || 
                entityType.contains("EXIT")) {
                return "EGRESS";
            }
            if (entityType.contains("STAIR") || entityType.contains("RAMP") || 
                entityType.contains("HANDRAIL")) {
                return "ACCESSIBILITY";
            }
            if (entityType.contains("SPACE")) {
                return "SPATIAL";
            }
        }
        
        if (!idsRule.getRequirements().isEmpty()) {
            for (IdsRequirement req : idsRule.getRequirements()) {
                if (req.getProperty() != null) {
                    return "PROPERTY";
                }
            }
        }
        
        return "INFORMATION";
    }

    private CreateRuleRevisionRequest toRevisionRequest(IdsRule idsRule, IdsSpecification spec) {
        String dslJson = buildDslJson(idsRule);
        Map<String, Object> parameters = buildParameters(idsRule);
        Map<String, Object> basis = buildRevisionBasis(idsRule, spec);
        
        return new CreateRuleRevisionRequest(
                dslJson,
                parameters,
                basis,
                "IDS_ENGINE",
                "从 IDS 规范导入"
        );
    }

    private String buildDslJson(IdsRule idsRule) {
        Map<String, Object> dsl = new LinkedHashMap<>();
        
        Map<String, Object> applicability = buildApplicability(idsRule.getApplicability());
        dsl.put("applicability", applicability);
        
        dsl.put("emptySet", "NOT_APPLICABLE");
        
        List<Map<String, Object>> assertions = buildAssertions(idsRule.getRequirements());
        dsl.put("assertions", assertions);
        
        Map<String, Object> outcomes = new LinkedHashMap<>();
        outcomes.put("missingData", "INDETERMINATE");
        outcomes.put("violation", "FAIL");
        dsl.put("outcomes", outcomes);
        
        List<String> evidence = new ArrayList<>();
        evidence.add("selectedEntities");
        evidence.add("propertyValues");
        evidence.add("threshold");
        dsl.put("evidence", evidence);
        
        return toJson(dsl);
    }

    Map<String, Object> buildApplicability(IdsApplicability app) {
        Map<String, Object> applicability = new LinkedHashMap<>();
        List<String> conditions = new ArrayList<>();
        StringBuilder selector = new StringBuilder();
        
        if (app != null) {
            if (app.getEntityType() != null) {
                selector.append("Ifc").append(app.getEntityType());
            }
            
            if (app.getPredefinedType() != null) {
                if (selector.length() > 0) {
                    selector.append(" where ");
                }
                selector.append("predefinedType == '").append(app.getPredefinedType()).append("'");
            }
            
            if (app.getClassification() != null) {
                conditions.add("classification.system == '" + app.getClassification() + "'");
                if (app.getClassificationValue() != null) {
                    conditions.add("classification.value == '" + app.getClassificationValue() + "'");
                }
            }
            
            if (app.getMaterial() != null) {
                conditions.add("material.name == '" + app.getMaterial() + "'");
            }
            
            if (app.getPropertySet() != null) {
                conditions.add("propertySet.name == '" + app.getPropertySet() + "'");
                if (app.getProperty() != null) {
                    conditions.add("property.name == '" + app.getProperty() + "'");
                }
            }
        }
        
        if (!conditions.isEmpty()) {
            applicability.put("all", conditions);
        }
        
        if (selector.length() > 0) {
            applicability.put("selector", selector.toString());
        }
        
        return applicability;
    }

    List<Map<String, Object>> buildAssertions(List<IdsRequirement> requirements) {
        List<Map<String, Object>> assertions = new ArrayList<>();
        
        for (IdsRequirement req : requirements) {
            Map<String, Object> assertion = new LinkedHashMap<>();
            
            assertion.put("quantifier", "forall");
            
            Map<String, Object> left = new LinkedHashMap<>();
            if (req.getPropertySet() != null) {
                left.put("propertySet", req.getPropertySet());
            }
            left.put("property", req.getProperty());
            assertion.put("left", left);
            
            String operator = determineOperator(req);
            assertion.put("operator", operator);
            
            Map<String, Object> right = new LinkedHashMap<>();
            if (req.getValue() != null) {
                right.put("value", convertValue(req.getValue(), req.getDataType()));
            }
            if (req.getMin() != null) {
                right.put("min", convertValue(req.getMin(), req.getDataType()));
            }
            if (req.getMax() != null) {
                right.put("max", convertValue(req.getMax(), req.getDataType()));
            }
            if (req.getPattern() != null) {
                right.put("pattern", req.getPattern());
            }
            if (req.getUnit() != null) {
                right.put("unit", req.getUnit());
            }
            assertion.put("right", right);
            
            assertion.put("requirementType", req.getRequirementType() != null ? req.getRequirementType().name() : "MANDATORY");
            
            assertions.add(assertion);
        }
        
        return assertions;
    }

    private String determineOperator(IdsRequirement req) {
        if (req.getPattern() != null) {
            return "MATCHES";
        }
        
        boolean hasMin = req.getMin() != null && !req.getMin().isBlank();
        boolean hasMax = req.getMax() != null && !req.getMax().isBlank();
        
        if (hasMin && hasMax) {
            return "BETWEEN";
        }
        if (hasMin) {
            return ">=";
        }
        if (hasMax) {
            return "<=";
        }
        
        return "==";
    }

    private Object convertValue(String value, IdsRequirement.DataType dataType) {
        if (value == null) {
            return null;
        }
        
        if (dataType == null) {
            return value;
        }
        
        return switch (dataType) {
            case INTEGER -> Integer.parseInt(value);
            case REAL -> Double.parseDouble(value);
            case BOOLEAN -> Boolean.parseBoolean(value);
            case ENUMERATION -> value;
            default -> value;
        };
    }

    Map<String, Object> buildParameters(IdsRule idsRule) {
        Map<String, Object> parameters = new LinkedHashMap<>();
        
        for (IdsRequirement req : idsRule.getRequirements()) {
            if (req.getValue() != null || req.getMin() != null || req.getMax() != null) {
                String paramName = req.getProperty();
                if (paramName == null) {
                    paramName = "requirement_" + req.hashCode();
                }
                
                Map<String, Object> param = new LinkedHashMap<>();
                param.put("type", req.getDataType() != null ? req.getDataType().name().toLowerCase() : "string");
                
                if (req.getUnit() != null) {
                    param.put("unit", req.getUnit());
                }
                
                if (req.getValue() != null) {
                    param.put("value", convertValue(req.getValue(), req.getDataType()));
                }
                
                if (req.getMin() != null) {
                    param.put("min", convertValue(req.getMin(), req.getDataType()));
                }
                
                if (req.getMax() != null) {
                    param.put("max", convertValue(req.getMax(), req.getDataType()));
                }
                
                parameters.put(paramName, param);
            }
        }
        
        return parameters;
    }

    private Map<String, Object> buildRevisionBasis(IdsRule idsRule, IdsSpecification spec) {
        Map<String, Object> basis = new LinkedHashMap<>();
        
        basis.put("source", "IDS");
        basis.put("idsVersion", spec.getVersion());
        basis.put("idsTitle", spec.getTitle());
        
        if (spec.getAuthor() != null) {
            basis.put("idsAuthor", spec.getAuthor());
        }
        
        if (spec.getPurpose() != null) {
            basis.put("idsPurpose", spec.getPurpose());
        }
        
        if (idsRule.getIfcVersion() != null) {
            basis.put("ifcVersion", idsRule.getIfcVersion());
        }
        
        return basis;
    }

    private String toJson(Map<String, Object> data) {
        StringBuilder sb = new StringBuilder();
        sb.append("{");
        boolean first = true;
        
        for (Map.Entry<String, Object> entry : data.entrySet()) {
            if (!first) {
                sb.append(",");
            }
            first = false;
            sb.append("\"").append(entry.getKey()).append("\":");
            sb.append(toJsonValue(entry.getValue()));
        }
        
        sb.append("}");
        return sb.toString();
    }

    private String toJsonValue(Object value) {
        if (value == null) {
            return "null";
        }
        if (value instanceof String) {
            return "\"" + escapeJson((String) value) + "\"";
        }
        if (value instanceof Number || value instanceof Boolean) {
            return value.toString();
        }
        if (value instanceof List) {
            StringBuilder sb = new StringBuilder("[");
            boolean first = true;
            for (Object item : (List<?>) value) {
                if (!first) {
                    sb.append(",");
                }
                first = false;
                sb.append(toJsonValue(item));
            }
            sb.append("]");
            return sb.toString();
        }
        if (value instanceof Map) {
            return toJson((Map<String, Object>) value);
        }
        return "\"" + escapeJson(value.toString()) + "\"";
    }

    private String escapeJson(String str) {
        if (str == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (char c : str.toCharArray()) {
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default: sb.append(c);
            }
        }
        return sb.toString();
    }

    public record ConvertResult(
            String ruleCode,
            CreateRuleRequest ruleRequest,
            CreateRuleRevisionRequest revisionRequest
    ) {
    }
}