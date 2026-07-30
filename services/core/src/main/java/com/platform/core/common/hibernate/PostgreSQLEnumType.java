package com.platform.core.common.hibernate;

import org.hibernate.HibernateException;
import org.hibernate.engine.spi.SharedSessionContractImplementor;
import org.hibernate.usertype.ParameterizedType;
import org.hibernate.usertype.UserType;

import java.io.Serializable;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.Objects;
import java.util.Properties;

/**
 * Hibernate 自定义类型：将 Java 枚举映射为 PostgreSQL 原生枚举类型
 *
 * 背景：@Enumerated(EnumType.STRING) 发送 VARCHAR 值，但 PostgreSQL 自定义枚举列
 * 需要的是原生枚举值。此类型使用 Types.OTHER + setObject/getObject 确保正确的类型转换。
 *
 * 使用方式（通过 @Type 参数传递枚举全限定类名）：
 *   @Type(value = PostgreSQLEnumType.class, parameters = @Parameter(name = "enumClass", value = "com.platform.core.iam.domain.DataClassification"))
 *   @Column(name = "classification", columnDefinition = "data_classification", nullable = false)
 *   private DataClassification classification;
 */
public class PostgreSQLEnumType implements UserType<Object>, ParameterizedType {

    private Class<? extends Enum<?>> enumClass;

    public PostgreSQLEnumType() {
    }

    @Override
    public void setParameterValues(Properties parameters) {
        String className = parameters.getProperty("enumClass");
        if (className != null) {
            try {
                @SuppressWarnings("unchecked")
                Class<? extends Enum<?>> clazz = (Class<? extends Enum<?>>) Class.forName(className);
                this.enumClass = clazz;
            } catch (ClassNotFoundException e) {
                throw new IllegalArgumentException("枚举类未找到: " + className, e);
            }
        }
    }

    @Override
    public int getSqlType() {
        return Types.OTHER;
    }

    @Override
    public Class<Object> returnedClass() {
        return Object.class;
    }

    @Override
    public boolean equals(Object x, Object y) {
        return Objects.equals(x, y);
    }

    @Override
    public int hashCode(Object x) {
        return x != null ? x.hashCode() : 0;
    }

    @Override
    public Object nullSafeGet(ResultSet rs, int position, SharedSessionContractImplementor session, Object owner)
            throws SQLException {
        String value = rs.getString(position);
        if (value == null) {
            return null;
        }
        if (enumClass != null) {
            for (Enum<?> e : enumClass.getEnumConstants()) {
                if (e.name().equals(value)) {
                    return e;
                }
            }
        }
        return value;
    }

    @Override
    public void nullSafeSet(PreparedStatement st, Object value, int index, SharedSessionContractImplementor session)
            throws HibernateException, SQLException {
        if (value == null) {
            st.setNull(index, Types.OTHER);
        } else {
            // 使用 Types.OTHER 让 pgJDBC 将枚举对象的字符串值发送为原生 PostgreSQL 枚举
            st.setObject(index, value.toString(), Types.OTHER);
        }
    }

    @Override
    public Object deepCopy(Object value) {
        return value;
    }

    @Override
    public boolean isMutable() {
        return false;
    }

    @Override
    public Serializable disassemble(Object value) {
        return value != null ? value.toString() : null;
    }

    @Override
    public Object assemble(Serializable cached, Object owner) {
        if (cached == null) return null;
        if (enumClass != null) {
            for (Enum<?> e : enumClass.getEnumConstants()) {
                if (e.name().equals(cached.toString())) {
                    return e;
                }
            }
        }
        return cached;
    }
}
