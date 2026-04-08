package com.nova.backend.dto;

import com.nova.backend.entity.DataType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record CycleLogRequest(
        @NotBlank String encryptedData,
        @NotNull DataType dataType,
        @Pattern(regexp = "^$|^\\d{4}-\\d{2}-\\d{2}$", message = "logDate must be in YYYY-MM-DD format") String logDate
) {
}
