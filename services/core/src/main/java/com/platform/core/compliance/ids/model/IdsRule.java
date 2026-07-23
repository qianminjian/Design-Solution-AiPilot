package com.platform.core.compliance.ids.model;

import java.util.ArrayList;
import java.util.List;

public class IdsRule {

    private String name;
    private String description;
    private IdsApplicability applicability;
    private final List<IdsRequirement> requirements = new ArrayList<>();
    private String ifcVersion;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public IdsApplicability getApplicability() {
        return applicability;
    }

    public void setApplicability(IdsApplicability applicability) {
        this.applicability = applicability;
    }

    public List<IdsRequirement> getRequirements() {
        return requirements;
    }

    public void addRequirement(IdsRequirement requirement) {
        this.requirements.add(requirement);
    }

    public String getIfcVersion() {
        return ifcVersion;
    }

    public void setIfcVersion(String ifcVersion) {
        this.ifcVersion = ifcVersion;
    }
}