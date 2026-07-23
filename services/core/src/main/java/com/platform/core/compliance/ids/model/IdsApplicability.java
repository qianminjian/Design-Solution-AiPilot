package com.platform.core.compliance.ids.model;

import java.util.ArrayList;
import java.util.List;

public class IdsApplicability {

    private String entityType;
    private String predefinedType;
    private String propertySet;
    private String property;
    private String classification;
    private String classificationValue;
    private String material;
    private String materialCategory;
    private List<String> entityTypes = new ArrayList<>();
    private boolean inherited = false;

    public String getEntityType() {
        return entityType;
    }

    public void setEntityType(String entityType) {
        this.entityType = entityType;
    }

    public String getPredefinedType() {
        return predefinedType;
    }

    public void setPredefinedType(String predefinedType) {
        this.predefinedType = predefinedType;
    }

    public String getPropertySet() {
        return propertySet;
    }

    public void setPropertySet(String propertySet) {
        this.propertySet = propertySet;
    }

    public String getProperty() {
        return property;
    }

    public void setProperty(String property) {
        this.property = property;
    }

    public String getClassification() {
        return classification;
    }

    public void setClassification(String classification) {
        this.classification = classification;
    }

    public String getClassificationValue() {
        return classificationValue;
    }

    public void setClassificationValue(String classificationValue) {
        this.classificationValue = classificationValue;
    }

    public String getMaterial() {
        return material;
    }

    public void setMaterial(String material) {
        this.material = material;
    }

    public String getMaterialCategory() {
        return materialCategory;
    }

    public void setMaterialCategory(String materialCategory) {
        this.materialCategory = materialCategory;
    }

    public List<String> getEntityTypes() {
        return entityTypes;
    }

    public void setEntityTypes(List<String> entityTypes) {
        this.entityTypes = entityTypes;
    }

    public void addEntityType(String entityType) {
        this.entityTypes.add(entityType);
    }

    public boolean isInherited() {
        return inherited;
    }

    public void setInherited(boolean inherited) {
        this.inherited = inherited;
    }
}