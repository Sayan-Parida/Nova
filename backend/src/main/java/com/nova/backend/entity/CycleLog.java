package com.nova.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Index;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(
    name = "cycle_logs",
    uniqueConstraints = @UniqueConstraint(name = "uk_cycle_logs_user_day", columnNames = {"user_id", "log_date"}),
    indexes = {
        @Index(name = "idx_cycle_logs_user_id", columnList = "user_id"),
        @Index(name = "idx_cycle_logs_log_date", columnList = "log_date")
    }
)
public class CycleLog {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private byte[] encryptedData;

    @Column(nullable = false, updatable = false)
    private Instant timestamp;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DataType dataType;

    @Column(name = "log_date")
    private LocalDate logDate;

    @PrePersist
    void onCreate() {
        this.timestamp = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public byte[] getEncryptedData() {
        return encryptedData;
    }

    public void setEncryptedData(byte[] encryptedData) {
        this.encryptedData = encryptedData;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public DataType getDataType() {
        return dataType;
    }

    public void setDataType(DataType dataType) {
        this.dataType = dataType;
    }

    public LocalDate getLogDate() {
        return logDate;
    }

    public void setLogDate(LocalDate logDate) {
        this.logDate = logDate;
    }
}
