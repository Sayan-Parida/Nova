package com.nova.backend.service;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtException;
import ai.onnxruntime.OrtSession;
import com.nova.backend.dto.PredictionResult;
import com.nova.backend.exception.BadRequestException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.FloatBuffer;
import java.time.LocalDate;
import java.util.Map;

@Service
public class PredictionService {

    private static final Logger logger = LoggerFactory.getLogger(PredictionService.class);

    public PredictionResult runInference(byte[] inputData) {
        if (inputData == null || inputData.length == 0) {
            throw new BadRequestException("inputData cannot be empty.");
        }

        ClassPathResource modelResource = new ClassPathResource("models/cycle_model.onnx");
        if (!modelResource.exists()) {
            logger.warn("ONNX model file not found. Falling back to heuristic prediction.");
            return fallbackPrediction(inputData);
        }

        float[] features = new float[inputData.length];
        for (int i = 0; i < inputData.length; i++) {
            features[i] = Byte.toUnsignedInt(inputData[i]) / 255.0f;
        }

        try (OrtEnvironment env = OrtEnvironment.getEnvironment();
             OrtSession session = env.createSession(modelResource.getContentAsByteArray(), new OrtSession.SessionOptions());
             OnnxTensor tensor = OnnxTensor.createTensor(env, FloatBuffer.wrap(features), new long[]{1, features.length})) {

            String inputName = session.getInputNames().iterator().next();
            try (OrtSession.Result result = session.run(Map.of(inputName, tensor))) {
                float modelSignal = extractModelSignal(result);
                float confidence = Math.max(0.5f, Math.min(0.99f, Math.abs(modelSignal)));
                int predictedOffsetDays = Math.max(20, Math.min(40, Math.round(28 + modelSignal * 7)));

                return new PredictionResult(
                        LocalDate.now().plusDays(predictedOffsetDays).toString(),
                        String.format("%.2f - %.2f", Math.max(0.0f, confidence - 0.1f), confidence)
                );
            }
        } catch (OrtException | IOException ex) {
            logger.warn("ONNX inference failed. Falling back to heuristic prediction: {}", ex.getMessage());
            return fallbackPrediction(inputData);
        }
    }

    private PredictionResult fallbackPrediction(byte[] inputData) {
        int sum = 0;
        for (byte b : inputData) {
            sum += Byte.toUnsignedInt(b);
        }

        float normalizedAverage = inputData.length == 0 ? 0.5f : (sum / (float) inputData.length) / 255.0f;
        int predictedOffsetDays = Math.max(22, Math.min(38, Math.round(24 + normalizedAverage * 12)));
        float confidence = Math.max(0.55f, Math.min(0.80f, 0.55f + normalizedAverage * 0.20f));

        return new PredictionResult(
                LocalDate.now().plusDays(predictedOffsetDays).toString(),
                String.format("%.2f - %.2f", Math.max(0.0f, confidence - 0.12f), confidence)
        );
    }

    private float extractModelSignal(OrtSession.Result result) throws OrtException {
        if (result.size() == 0 || result.get(0) == null) {
            return 0.0f;
        }

        Object value = result.get(0).getValue();
        if (value instanceof float[] output1D && output1D.length > 0) {
            return output1D[0];
        }
        if (value instanceof float[][] output2D && output2D.length > 0 && output2D[0].length > 0) {
            return output2D[0][0];
        }

        return 0.0f;
    }
}
