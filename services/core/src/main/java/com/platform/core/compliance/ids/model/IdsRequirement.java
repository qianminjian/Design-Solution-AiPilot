package com.platform.core.compliance.ids.model;

public class IdsRequirement {

    public enum RequirementType {
        MANDATORY,
        OPTIONAL,
        PROHIBITED
    }

    public enum DataType {
        STRING,
        INTEGER,
        REAL,
        BOOLEAN,
        DATE,
        TIME,
        DATETIME,
        URI,
        ENUMERATION,
        IFCDATE,
        IFCTIME,
        IFCDATETIME,
        IFCDURATION,
        IFCCURRENCY,
        IFCSIUNIT,
        IFCCONVERSIONBASEDUNIT,
        IFCDERIVEDUNIT
    }

    private String propertySet;
    private String property;
    private DataType dataType;
    private RequirementType requirementType;
    private String value;
    private String min;
    private String max;
    private String pattern;
    private String unit;
    private boolean inherited = false;

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

    public DataType getDataType() {
        return dataType;
    }

    public void setDataType(DataType dataType) {
        this.dataType = dataType;
    }

    public RequirementType getRequirementType() {
        return requirementType;
    }

    public void setRequirementType(RequirementType requirementType) {
        this.requirementType = requirementType;
    }

    public String getValue() {
        return value;
    }

    public void setValue(String value) {
        this.value = value;
    }

    public String getMin() {
        return min;
    }

    public void setMin(String min) {
        this.min = min;
    }

    public String getMax() {
        return max;
    }

    public void setMax(String max) {
        this.max = max;
    }

    public String getPattern() {
        return pattern;
    }

    public void setPattern(String pattern) {
        this.pattern = pattern;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public boolean isInherited() {
        return inherited;
    }

    public void setInherited(boolean inherited) {
        this.inherited = inherited;
    }
}