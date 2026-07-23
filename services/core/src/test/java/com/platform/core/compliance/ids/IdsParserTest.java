package com.platform.core.compliance.ids;

import com.platform.core.compliance.ids.model.IdsApplicability;
import com.platform.core.compliance.ids.model.IdsRequirement;
import com.platform.core.compliance.ids.model.IdsRule;
import com.platform.core.compliance.ids.model.IdsSpecification;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

class IdsParserTest {

    private final IdsParser parser = new IdsParser();

    @Test
    @DisplayName("应该能解析基本的 IDS XML")
    void shouldParseBasicIdsXml() {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <specification xmlns="http://standards.buildingsmart.org/IDS">
                    <title>建筑信息交付规范</title>
                    <version>1.0</version>
                    <purpose>测试规范</purpose>
                    <author>测试用户</author>
                    <rule>
                        <name>墙体厚度要求</name>
                        <description>墙体厚度应在100-300mm之间</description>
                        <applicability>
                            <entityType>Wall</entityType>
                            <predefinedType>Standard</predefinedType>
                        </applicability>
                        <requirement type="mandatory">
                            <propertySet>BaseQuantities</propertySet>
                            <property>NominalThickness</property>
                            <datatype>Real</datatype>
                            <min>100</min>
                            <max>300</max>
                            <unit>mm</unit>
                        </requirement>
                    </rule>
                </specification>
                """;

        IdsSpecification spec = parser.parse(xml);

        assertNotNull(spec);
        assertEquals("建筑信息交付规范", spec.getTitle());
        assertEquals("1.0", spec.getVersion());
        assertEquals("测试规范", spec.getPurpose());
        assertEquals("测试用户", spec.getAuthor());
        assertEquals(1, spec.getRules().size());

        IdsRule rule = spec.getRules().get(0);
        assertEquals("墙体厚度要求", rule.getName());
        assertEquals("墙体厚度应在100-300mm之间", rule.getDescription());

        IdsApplicability app = rule.getApplicability();
        assertNotNull(app);
        assertEquals("Wall", app.getEntityType());
        assertEquals("Standard", app.getPredefinedType());

        assertEquals(1, rule.getRequirements().size());
        IdsRequirement req = rule.getRequirements().get(0);
        assertEquals("BaseQuantities", req.getPropertySet());
        assertEquals("NominalThickness", req.getProperty());
        assertEquals(IdsRequirement.DataType.REAL, req.getDataType());
        assertEquals(IdsRequirement.RequirementType.MANDATORY, req.getRequirementType());
        assertEquals("100", req.getMin());
        assertEquals("300", req.getMax());
        assertEquals("mm", req.getUnit());
    }

    @Test
    @DisplayName("应该能解析包含多个规则的 IDS XML")
    void shouldParseIdsXmlWithMultipleRules() {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <specification xmlns="http://standards.buildingsmart.org/IDS">
                    <title>多规则测试规范</title>
                    <version>2.0</version>
                    <rule>
                        <name>规则一</name>
                        <applicability>
                            <entityType>Wall</entityType>
                        </applicability>
                    </rule>
                    <rule>
                        <name>规则二</name>
                        <applicability>
                            <entityType>Door</entityType>
                        </applicability>
                    </rule>
                </specification>
                """;

        IdsSpecification spec = parser.parse(xml);

        assertEquals(2, spec.getRules().size());
        assertEquals("规则一", spec.getRules().get(0).getName());
        assertEquals("规则二", spec.getRules().get(1).getName());
    }

    @Test
    @DisplayName("应该能解析包含分类和材料条件的适用性")
    void shouldParseApplicabilityWithClassificationAndMaterial() {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <specification xmlns="http://standards.buildingsmart.org/IDS">
                    <title>分类测试规范</title>
                    <version>1.0</version>
                    <rule>
                        <name>防火门要求</name>
                        <applicability>
                            <entityType>Door</entityType>
                            <classification>GB</classification>
                            <classificationValue>防火门</classificationValue>
                            <material>钢材</material>
                        </applicability>
                    </rule>
                </specification>
                """;

        IdsSpecification spec = parser.parse(xml);
        IdsApplicability app = spec.getRules().get(0).getApplicability();

        assertEquals("GB", app.getClassification());
        assertEquals("防火门", app.getClassificationValue());
        assertEquals("钢材", app.getMaterial());
    }

    @Test
    @DisplayName("应该能解析不同类型的需求")
    void shouldParseDifferentRequirementTypes() {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <specification xmlns="http://standards.buildingsmart.org/IDS">
                    <title>需求类型测试</title>
                    <version>1.0</version>
                    <rule>
                        <name>测试规则</name>
                        <applicability>
                            <entityType>Wall</entityType>
                        </applicability>
                        <requirement type="mandatory">
                            <property>必填属性</property>
                            <datatype>String</datatype>
                        </requirement>
                        <requirement type="optional">
                            <property>可选属性</property>
                            <datatype>Integer</datatype>
                        </requirement>
                        <requirement type="prohibited">
                            <property>禁止属性</property>
                            <datatype>String</datatype>
                        </requirement>
                    </rule>
                </specification>
                """;

        IdsSpecification spec = parser.parse(xml);
        IdsRule rule = spec.getRules().get(0);

        assertEquals(3, rule.getRequirements().size());
        assertEquals(IdsRequirement.RequirementType.MANDATORY, rule.getRequirements().get(0).getRequirementType());
        assertEquals(IdsRequirement.RequirementType.OPTIONAL, rule.getRequirements().get(1).getRequirementType());
        assertEquals(IdsRequirement.RequirementType.PROHIBITED, rule.getRequirements().get(2).getRequirementType());
    }

    @Test
    @DisplayName("应该能解析带值和模式的需求")
    void shouldParseRequirementWithValueAndPattern() {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <specification xmlns="http://standards.buildingsmart.org/IDS">
                    <title>值和模式测试</title>
                    <version>1.0</version>
                    <rule>
                        <name>测试规则</name>
                        <applicability>
                            <entityType>Space</entityType>
                        </applicability>
                        <requirement>
                            <property>名称</property>
                            <datatype>String</datatype>
                            <value>办公室</value>
                        </requirement>
                        <requirement>
                            <property>编码</property>
                            <datatype>String</datatype>
                            <pattern>^ROOM-\\d{3}$</pattern>
                        </requirement>
                    </rule>
                </specification>
                """;

        IdsSpecification spec = parser.parse(xml);
        IdsRule rule = spec.getRules().get(0);

        assertEquals("办公室", rule.getRequirements().get(0).getValue());
        assertEquals("^ROOM-\\d{3}$", rule.getRequirements().get(1).getPattern());
    }

    @Test
    @DisplayName("应该拒绝空的 XML 内容")
    void shouldRejectEmptyXmlContent() {
        assertThrows(IllegalArgumentException.class, () -> parser.parse(""));
        assertThrows(IllegalArgumentException.class, () -> parser.parse(null));
        assertThrows(IllegalArgumentException.class, () -> parser.parse("   "));
    }

    @Test
    @DisplayName("应该拒绝无效的 XML")
    void shouldRejectInvalidXml() {
        String invalidXml = "<specification><title>测试</specification";
        assertThrows(RuntimeException.class, () -> parser.parse(invalidXml));
    }

    @Test
    @DisplayName("应该拒绝非 specification 根元素")
    void shouldRejectNonSpecificationRootElement() {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <invalidRoot xmlns="http://standards.buildingsmart.org/IDS">
                    <title>测试</title>
                </invalidRoot>
                """;
        assertThrows(IllegalArgumentException.class, () -> parser.parse(xml));
    }

    @Test
    @DisplayName("应该能解析带 ifcVersion 属性的规则")
    void shouldParseRuleWithIfcVersion() {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <specification xmlns="http://standards.buildingsmart.org/IDS">
                    <title>IFC版本测试</title>
                    <version>1.0</version>
                    <rule ifcVersion="IFC2X3">
                        <name>IFC2X3规则</name>
                        <applicability>
                            <entityType>Wall</entityType>
                        </applicability>
                    </rule>
                </specification>
                """;

        IdsSpecification spec = parser.parse(xml);
        assertEquals("IFC2X3", spec.getRules().get(0).getIfcVersion());
    }

    @Test
    @DisplayName("应该能解析带继承属性的适用性和需求")
    void shouldParseApplicabilityAndRequirementWithInherited() {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <specification xmlns="http://standards.buildingsmart.org/IDS">
                    <title>继承属性测试</title>
                    <version>1.0</version>
                    <rule>
                        <name>继承规则</name>
                        <applicability inherited="true">
                            <entityType>Wall</entityType>
                        </applicability>
                        <requirement inherited="true">
                            <property>继承属性</property>
                            <datatype>String</datatype>
                        </requirement>
                    </rule>
                </specification>
                """;

        IdsSpecification spec = parser.parse(xml);
        IdsRule rule = spec.getRules().get(0);

        assertTrue(rule.getApplicability().isInherited());
        assertTrue(rule.getRequirements().get(0).isInherited());
    }
}