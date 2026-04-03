package com.nova.backend.dto;

public record PredictionResult(
        String predictedDate,
        String confidenceRange
) {
}
