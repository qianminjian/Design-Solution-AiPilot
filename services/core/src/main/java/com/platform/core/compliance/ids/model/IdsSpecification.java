package com.platform.core.compliance.ids.model;

import java.util.ArrayList;
import java.util.List;

public class IdsSpecification {

    private String title;
    private String version;
    private String purpose;
    private String copyright;
    private String author;
    private String description;
    private final List<IdsRule> rules = new ArrayList<>();

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public String getPurpose() {
        return purpose;
    }

    public void setPurpose(String purpose) {
        this.purpose = purpose;
    }

    public String getCopyright() {
        return copyright;
    }

    public void setCopyright(String copyright) {
        this.copyright = copyright;
    }

    public String getAuthor() {
        return author;
    }

    public void setAuthor(String author) {
        this.author = author;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public List<IdsRule> getRules() {
        return rules;
    }

    public void addRule(IdsRule rule) {
        this.rules.add(rule);
    }
}