package com.nova.backend.dto;

import com.nova.backend.entity.DataType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CycleLogRequest(
        @NotBlank String encryptedData,
        @NotNull DataType dataType,
        String logDate
) {
}
