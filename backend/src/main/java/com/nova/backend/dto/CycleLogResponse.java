package com.nova.backend.dto;

import com.nova.backend.entity.DataType;

import java.time.Instant;
import java.util.UUID;

public record CycleLogResponse(
        UUID id,
        UUID userId,
        String encryptedData,
        Instant timestamp,
        DataType dataType
) {
}
