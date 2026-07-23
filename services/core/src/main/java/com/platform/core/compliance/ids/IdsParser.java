package com.platform.core.compliance.ids;

import com.platform.core.compliance.ids.model.IdsApplicability;
import com.platform.core.compliance.ids.model.IdsRequirement;
import com.platform.core.compliance.ids.model.IdsRequirement.DataType;
import com.platform.core.compliance.ids.model.IdsRequirement.RequirementType;
import com.platform.core.compliance.ids.model.IdsRule;
import com.platform.core.compliance.ids.model.IdsSpecification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;

@Component
public class IdsParser {

    private static final Logger log = LoggerFactory.getLogger(IdsParser.class);

    private static final String NS_URI = "http://standards.buildingsmart.org/IDS";

    public IdsSpecification parse(String xmlContent) {
        if (xmlContent == null || xmlContent.isBlank()) {
            throw new IllegalArgumentException("IDS XML 内容不能为空");
        }

        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            DocumentBuilder builder = factory.newDocumentBuilder();
            InputSource source = new InputSource(new StringReader(xmlContent));
            Document doc = builder.parse(source);

            return parseDocument(doc);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("IDS XML 解析失败", e);
            throw new RuntimeException("IDS XML 解析失败: " + e.getMessage(), e);
        }
    }

    private IdsSpecification parseDocument(Document doc) {
        Element root = doc.getDocumentElement();

        String rootTag = getLocalName(root);
        if (!"specification".equals(rootTag)) {
            throw new IllegalArgumentException("IDS XML 根元素必须是 specification");
        }

        IdsSpecification spec = new IdsSpecification();

        spec.setTitle(getElementText(root, "title"));
        spec.setVersion(getElementText(root, "version"));
        spec.setPurpose(getElementText(root, "purpose"));
        spec.setCopyright(getElementText(root, "copyright"));
        spec.setAuthor(getElementText(root, "author"));
        spec.setDescription(getElementText(root, "description"));

        NodeList ruleNodes = getElementsByTagName(root, "rule");
        for (int i = 0; i < ruleNodes.getLength(); i++) {
            Element ruleElement = (Element) ruleNodes.item(i);
            IdsRule rule = parseRule(ruleElement);
            spec.addRule(rule);
        }

        log.info("IDS 解析完成: title={}, version={}, rules={}", 
                spec.getTitle(), spec.getVersion(), spec.getRules().size());
        return spec;
    }

    private IdsRule parseRule(Element ruleElement) {
        IdsRule rule = new IdsRule();

        rule.setName(getElementText(ruleElement, "name"));
        rule.setDescription(getElementText(ruleElement, "description"));
        rule.setIfcVersion(getAttribute(ruleElement, "ifcVersion"));

        NodeList applicabilityNodes = getElementsByTagName(ruleElement, "applicability");
        if (applicabilityNodes.getLength() > 0) {
            Element appElement = (Element) applicabilityNodes.item(0);
            rule.setApplicability(parseApplicability(appElement));
        }

        NodeList requirementNodes = getElementsByTagName(ruleElement, "requirement");
        for (int i = 0; i < requirementNodes.getLength(); i++) {
            Element reqElement = (Element) requirementNodes.item(i);
            IdsRequirement req = parseRequirement(reqElement);
            rule.addRequirement(req);
        }

        return rule;
    }

    private IdsApplicability parseApplicability(Element appElement) {
        IdsApplicability applicability = new IdsApplicability();

        applicability.setEntityType(getElementText(appElement, "entityType"));
        applicability.setPredefinedType(getElementText(appElement, "predefinedType"));
        applicability.setPropertySet(getElementText(appElement, "propertySet"));
        applicability.setProperty(getElementText(appElement, "property"));
        applicability.setClassification(getElementText(appElement, "classification"));
        applicability.setClassificationValue(getElementText(appElement, "classificationValue"));
        applicability.setMaterial(getElementText(appElement, "material"));
        applicability.setMaterialCategory(getElementText(appElement, "materialCategory"));

        String inheritedAttr = getAttribute(appElement, "inherited");
        if (inheritedAttr != null && !inheritedAttr.isBlank()) {
            applicability.setInherited(Boolean.parseBoolean(inheritedAttr));
        }

        NodeList entityTypeNodes = getElementsByTagName(appElement, "entityType");
        for (int i = 0; i < entityTypeNodes.getLength(); i++) {
            Element etElement = (Element) entityTypeNodes.item(i);
            String entityType = etElement.getTextContent().trim();
            if (!entityType.isBlank()) {
                applicability.addEntityType(entityType);
            }
        }

        return applicability;
    }

    private IdsRequirement parseRequirement(Element reqElement) {
        IdsRequirement requirement = new IdsRequirement();

        String reqTypeAttr = getAttribute(reqElement, "type");
        if (reqTypeAttr != null) {
            requirement.setRequirementType(parseRequirementType(reqTypeAttr));
        } else {
            requirement.setRequirementType(RequirementType.MANDATORY);
        }

        requirement.setPropertySet(getElementText(reqElement, "propertySet"));
        requirement.setProperty(getElementText(reqElement, "property"));
        requirement.setDataType(parseDataType(getElementText(reqElement, "datatype")));
        requirement.setValue(getElementText(reqElement, "value"));
        requirement.setMin(getElementText(reqElement, "min"));
        requirement.setMax(getElementText(reqElement, "max"));
        requirement.setPattern(getElementText(reqElement, "pattern"));
        requirement.setUnit(getElementText(reqElement, "unit"));

        String inheritedAttr = getAttribute(reqElement, "inherited");
        if (inheritedAttr != null && !inheritedAttr.isBlank()) {
            requirement.setInherited(Boolean.parseBoolean(inheritedAttr));
        }

        return requirement;
    }

    private RequirementType parseRequirementType(String value) {
        if (value == null || value.isBlank()) {
            return RequirementType.MANDATORY;
        }
        return switch (value.toUpperCase()) {
            case "OPTIONAL" -> RequirementType.OPTIONAL;
            case "PROHIBITED" -> RequirementType.PROHIBITED;
            default -> RequirementType.MANDATORY;
        };
    }

    private DataType parseDataType(String value) {
        if (value == null || value.isBlank()) {
            return DataType.STRING;
        }
        try {
            return DataType.valueOf(value.toUpperCase().replace("-", ""));
        } catch (IllegalArgumentException e) {
            log.warn("未知的数据类型: {}, 默认使用 STRING", value);
            return DataType.STRING;
        }
    }

    private NodeList getElementsByTagName(Element parent, String localName) {
        return parent.getElementsByTagNameNS(NS_URI, localName);
    }

    private String getElementText(Element parent, String localName) {
        NodeList nodes = getElementsByTagName(parent, localName);
        if (nodes.getLength() > 0) {
            String text = nodes.item(0).getTextContent();
            return text != null ? text.trim() : null;
        }
        return null;
    }

    private String getAttribute(Element element, String name) {
        String value = element.getAttribute(name);
        return value != null && !value.isBlank() ? value.trim() : null;
    }

    private String getLocalName(Node node) {
        String localName = node.getLocalName();
        if (localName == null) {
            localName = node.getNodeName();
            int colonIndex = localName.indexOf(':');
            if (colonIndex > 0) {
                localName = localName.substring(colonIndex + 1);
            }
        }
        return localName;
    }
}