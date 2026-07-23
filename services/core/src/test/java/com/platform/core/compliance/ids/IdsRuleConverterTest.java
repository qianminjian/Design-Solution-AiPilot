package com.platform.core.compliance.ids;

import com.platform.core.compliance.ids.model.IdsApplicability;
import com.platform.core.compliance.ids.model.IdsRequirement;
import com.platform.core.compliance.ids.model.IdsRequirement.DataType;
import com.platform.core.compliance.ids.model.IdsRequirement.RequirementType;
import com.platform.core.compliance.ids.model.IdsRule;
import com.platform.core.compliance.ids.model.IdsSpecification;
import com.platform.core.compliance.dto.CreateRuleRequest;
import com.platform.core.compliance.dto.CreateRuleRevisionRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class IdsRuleConverterTest {

    private final IdsRuleConverter converter = new IdsRuleConverter();

    @Test
    @DisplayName("应该能转换基本的 IDS 规范")
    void shouldConvertBasicIdsSpecification() {
        IdsSpecification spec = createBasicSpecification();

        List<IdsRuleConverter.ConvertResult> results = converter.convert(spec);

        assertEquals(1, results.size());
        IdsRuleConverter.ConvertResult result = results.get(0);

        assertNotNull(result.ruleCode());
        assertTrue(result.ruleCode().startsWith("ARCHITECTURAL"));

        CreateRuleRequest ruleRequest = result.ruleRequest();
        assertEquals("墙体厚度要求", ruleRequest.name());
        assertEquals("GEOMETRY", ruleRequest.category());
        assertNotNull(ruleRequest.basis());
        assertEquals("IDS", ruleRequest.basis().get("source"));
        assertEquals("1.0", ruleRequest.basis().get("idsVersion"));

        CreateRuleRevisionRequest revisionRequest = result.revisionRequest();
        assertNotNull(revisionRequest.dslJson());
        assertTrue(revisionRequest.dslJson().contains("Wall"));
        assertTrue(revisionRequest.dslJson().contains("NominalThickness"));
        assertEquals("IDS_ENGINE", revisionRequest.engineProfile());
    }

    @Test
    @DisplayName("应该能转换包含多个规则的规范")
    void shouldConvertSpecificationWithMultipleRules() {
        IdsSpecification spec = new IdsSpecification();
        spec.setTitle("多规则测试");
        spec.setVersion("1.0");

        IdsRule rule1 = createRule("规则一", "Wall");
        IdsRule rule2 = createRule("规则二", "Door");
        spec.addRule(rule1);
        spec.addRule(rule2);

        List<IdsRuleConverter.ConvertResult> results = converter.convert(spec);

        assertEquals(2, results.size());
        assertEquals("规则一", results.get(0).ruleRequest().name());
        assertEquals("规则二", results.get(1).ruleRequest().name());
    }

    @Test
    @DisplayName("应该能根据实体类型确定规则类别")
    void shouldDetermineCategoryBasedOnEntityType() {
        assertEquals("GEOMETRY", converter.determineCategory(createRule("墙体规则", "Wall")));
        assertEquals("EGRESS", converter.determineCategory(createRule("门规则", "Door")));
        assertEquals("EGRESS", converter.determineCategory(createRule("窗规则", "Window")));
        assertEquals("ACCESSIBILITY", converter.determineCategory(createRule("楼梯规则", "Stair")));
        assertEquals("SPATIAL", converter.determineCategory(createRule("空间规则", "Space")));
        assertEquals("PROPERTY", converter.determineCategory(createRuleWithPropertyRequirement()));
        assertEquals("INFORMATION", converter.determineCategory(createRule("通用规则", null)));
    }

    @Test
    @DisplayName("应该能构建包含选择器和条件的适用性")
    void shouldBuildApplicabilityWithSelectorAndConditions() {
        IdsApplicability app = new IdsApplicability();
        app.setEntityType("Wall");
        app.setPredefinedType("Standard");
        app.setClassification("GB");
        app.setClassificationValue("承重墙");

        Map<String, Object> applicability = converter.buildApplicability(app);

        assertNotNull(applicability);
        assertTrue(applicability.containsKey("selector"));
        assertTrue(applicability.containsKey("all"));
        assertTrue(applicability.get("selector").toString().contains("IfcWall"));
        assertTrue(applicability.get("selector").toString().contains("predefinedType"));
    }

    @Test
    @DisplayName("应该能构建包含范围要求的断言")
    void shouldBuildAssertionsWithRangeRequirements() {
        IdsRequirement req = new IdsRequirement();
        req.setPropertySet("BaseQuantities");
        req.setProperty("NominalThickness");
        req.setDataType(DataType.REAL);
        req.setRequirementType(RequirementType.MANDATORY);
        req.setMin("100");
        req.setMax("300");
        req.setUnit("mm");

        List<Map<String, Object>> assertions = converter.buildAssertions(List.of(req));

        assertEquals(1, assertions.size());
        Map<String, Object> assertion = assertions.get(0);
        assertEquals("forall", assertion.get("quantifier"));
        assertEquals("BETWEEN", assertion.get("operator"));

        @SuppressWarnings("unchecked")
        Map<String, Object> right = (Map<String, Object>) assertion.get("right");
        assertEquals(100.0, right.get("min"));
        assertEquals(300.0, right.get("max"));
        assertEquals("mm", right.get("unit"));
    }

    @Test
    @DisplayName("应该能构建包含值要求的断言")
    void shouldBuildAssertionsWithValueRequirements() {
        IdsRequirement req = new IdsRequirement();
        req.setProperty("Status");
        req.setDataType(DataType.STRING);
        req.setValue("Active");

        List<Map<String, Object>> assertions = converter.buildAssertions(List.of(req));

        assertEquals(1, assertions.size());
        Map<String, Object> assertion = assertions.get(0);
        assertEquals("==", assertion.get("operator"));

        @SuppressWarnings("unchecked")
        Map<String, Object> right = (Map<String, Object>) assertion.get("right");
        assertEquals("Active", right.get("value"));
    }

    @Test
    @DisplayName("应该能构建包含模式要求的断言")
    void shouldBuildAssertionsWithPatternRequirements() {
        IdsRequirement req = new IdsRequirement();
        req.setProperty("Code");
        req.setDataType(DataType.STRING);
        req.setPattern("^ROOM-\\d{3}$");

        List<Map<String, Object>> assertions = converter.buildAssertions(List.of(req));

        assertEquals(1, assertions.size());
        Map<String, Object> assertion = assertions.get(0);
        assertEquals("MATCHES", assertion.get("operator"));

        @SuppressWarnings("unchecked")
        Map<String, Object> right = (Map<String, Object>) assertion.get("right");
        assertEquals("^ROOM-\\d{3}$", right.get("pattern"));
    }

    @Test
    @DisplayName("应该能生成规则编码")
    void shouldGenerateRuleCode() {
        assertEquals("TESTSPECIFICATI-0001", converter.generateRuleCode("Test Specification", 1));
        assertEquals("TESTSPECIFICATI-0002", converter.generateRuleCode("Test Specification", 2));
        assertEquals("LONGNAMESPECIFI-0001", converter.generateRuleCode("Long Name Specification", 1));
        assertEquals("IDS-0001", converter.generateRuleCode(null, 1));
        assertEquals("IDS-0001", converter.generateRuleCode("", 1));
    }

    @Test
    @DisplayName("应该能构建参数映射")
    void shouldBuildParameters() {
        IdsRule rule = createRuleWithPropertyRequirement();
        IdsRequirement req = rule.getRequirements().get(0);
        req.setValue("100");
        req.setUnit("mm");

        Map<String, Object> parameters = converter.buildParameters(rule);

        assertNotNull(parameters);
        assertTrue(parameters.containsKey("TestProperty"));

        @SuppressWarnings("unchecked")
        Map<String, Object> param = (Map<String, Object>) parameters.get("TestProperty");
        assertEquals("string", param.get("type"));
        assertEquals("100", param.get("value"));
        assertEquals("mm", param.get("unit"));
    }

    private IdsSpecification createBasicSpecification() {
        IdsSpecification spec = new IdsSpecification();
        spec.setTitle("Architectural Requirements");
        spec.setVersion("1.0");
        spec.setAuthor("Test Author");

        IdsRule rule = new IdsRule();
        rule.setName("墙体厚度要求");
        rule.setDescription("墙体厚度应在100-300mm之间");

        IdsApplicability app = new IdsApplicability();
        app.setEntityType("Wall");
        app.setPredefinedType("Standard");
        rule.setApplicability(app);

        IdsRequirement req = new IdsRequirement();
        req.setPropertySet("BaseQuantities");
        req.setProperty("NominalThickness");
        req.setDataType(DataType.REAL);
        req.setRequirementType(RequirementType.MANDATORY);
        req.setMin("100");
        req.setMax("300");
        req.setUnit("mm");
        rule.addRequirement(req);

        spec.addRule(rule);
        return spec;
    }

    private IdsRule createRule(String name, String entityType) {
        IdsRule rule = new IdsRule();
        rule.setName(name);

        if (entityType != null) {
            IdsApplicability app = new IdsApplicability();
            app.setEntityType(entityType);
            rule.setApplicability(app);
        }

        return rule;
    }

    private IdsRule createRuleWithPropertyRequirement() {
        IdsRule rule = new IdsRule();
        rule.setName("属性规则");

        IdsApplicability app = new IdsApplicability();
        app.setEntityType("Element");
        rule.setApplicability(app);

        IdsRequirement req = new IdsRequirement();
        req.setProperty("TestProperty");
        req.setDataType(DataType.STRING);
        rule.addRequirement(req);

        return rule;
    }
}