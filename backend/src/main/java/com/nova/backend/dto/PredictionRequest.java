package com.nova.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record PredictionRequest(
        @NotBlank String inputData
) {
}
