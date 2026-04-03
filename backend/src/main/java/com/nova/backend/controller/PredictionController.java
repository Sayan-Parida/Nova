package com.nova.backend.controller;

import com.nova.backend.dto.PredictionRequest;
import com.nova.backend.dto.PredictionResult;
import com.nova.backend.exception.BadRequestException;
import com.nova.backend.service.PredictionService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Base64;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class PredictionController {

    private final PredictionService predictionService;

    public PredictionController(PredictionService predictionService) {
        this.predictionService = predictionService;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP", "service", "nova-backend");
    }

    @PostMapping("/predictions/run")
    public PredictionResult runPrediction(@Valid @RequestBody PredictionRequest request) {
        byte[] inputData;
        try {
            inputData = Base64.getDecoder().decode(request.inputData());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("inputData must be valid Base64.");
        }

        return predictionService.runInference(inputData);
    }
}
