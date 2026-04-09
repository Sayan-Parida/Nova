package com.nova.backend;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nova.backend.repository.CycleLogRepository;
import com.nova.backend.repository.RateLimitBucketRepository;
import com.nova.backend.repository.RefreshTokenRepository;
import com.nova.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.mock.web.MockCookie;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class BackendIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CycleLogRepository cycleLogRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private RateLimitBucketRepository rateLimitBucketRepository;

    @BeforeEach
    void clearState() {
        cycleLogRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        rateLimitBucketRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void registerShouldReturnTokenAndRefreshCookie() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "new.user@nova.app",
                                  "password": "StrongPass123",
                                  "timezone": "UTC"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.expiresInSeconds").isNumber());
    }

    @Test
    void loginShouldSucceedWithCorrectPassword() throws Exception {
        register("login.user@nova.app", "StrongPass123");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "login.user@nova.app",
                                  "password": "StrongPass123"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty());
    }

    @Test
    void refreshShouldReturnNewAccessToken() throws Exception {
        MvcResult registerResult = register("refresh.user@nova.app", "StrongPass123");
        String refreshCookie = extractCookie(registerResult, "refresh_token");

        mockMvc.perform(post("/api/auth/refresh")
            .cookie(new MockCookie("refresh_token", refreshCookie)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty());
    }

    @Test
    void duplicateEmailShouldReturnBadRequest() throws Exception {
        register("dupe.user@nova.app", "StrongPass123");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "dupe.user@nova.app",
                                  "password": "StrongPass123",
                                  "timezone": "UTC"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Email already registered."));
    }

    @Test
    void wrongPasswordShouldReturnUnauthorized() throws Exception {
        register("wrong.password@nova.app", "StrongPass123");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "wrong.password@nova.app",
                                  "password": "WrongPass999"
                                }
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void saveCycleLogShouldSucceedForAuthenticatedUser() throws Exception {
        MvcResult registerResult = register("cycle.user@nova.app", "StrongPass123");
        String accessToken = extractAccessToken(registerResult);
        String encryptedData = Base64.getEncoder().encodeToString("encrypted-cycle".getBytes(StandardCharsets.UTF_8));

        mockMvc.perform(post("/api/cycles")
                        .header("Authorization", "Bearer " + accessToken)
                        .header("X-Timezone-Offset", "+00:00")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "encryptedData": "%s",
                                  "dataType": "CYCLE",
                                  "logDate": "%s"
                                }
                                """.formatted(encryptedData, LocalDate.now(ZoneOffset.UTC))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.dataType").value("CYCLE"))
                .andExpect(jsonPath("$.encryptedData").isNotEmpty());
    }

    @Test
    void unauthorizedCycleLogAccessShouldReturnUnauthorized() throws Exception {
        MvcResult userA = register("user.a@nova.app", "StrongPass123");
        MvcResult userB = register("user.b@nova.app", "StrongPass123");

        String tokenA = extractAccessToken(userA);
        String userBId = extractUserIdFromToken(extractAccessToken(userB));

        String encryptedData = Base64.getEncoder().encodeToString("encrypted-cycle".getBytes(StandardCharsets.UTF_8));

        mockMvc.perform(post("/api/cycles")
                        .header("Authorization", "Bearer " + tokenA)
                        .header("X-Timezone-Offset", "+00:00")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "encryptedData": "%s",
                                  "dataType": "CYCLE",
                                  "logDate": "%s"
                                }
                                """.formatted(encryptedData, LocalDate.now(ZoneOffset.UTC))))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/cycles/{userId}", userBId)
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rateLimitShouldTriggerAfterFiveAuthRequests() throws Exception {
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "email": "ghost@nova.app",
                                      "password": "WrongPass999"
                                    }
                                    """))
                    .andExpect(status().isUnauthorized());
        }

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "ghost@nova.app",
                                  "password": "WrongPass999"
                                }
                                """))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value("Rate limit exceeded. Please try again shortly."));
    }

    private MvcResult register(String email, String password) throws Exception {
        return mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "%s",
                                  "timezone": "UTC"
                                }
                                """.formatted(email, password)))
                .andExpect(status().isCreated())
                .andReturn();
    }

    private String extractAccessToken(MvcResult result) throws Exception {
        Map<String, Object> response = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                new TypeReference<>() {
                }
        );
        Object token = response.get("accessToken");
        assertThat(token).isNotNull();
        return String.valueOf(token);
    }

    private String extractCookie(MvcResult result, String cookieName) {
        String setCookie = result.getResponse().getHeader("Set-Cookie");
        assertThat(setCookie).isNotNull();
        String[] parts = setCookie.split(";");
        for (String part : parts) {
            String trimmed = part.trim();
            if (trimmed.startsWith(cookieName + "=")) {
                return trimmed.substring((cookieName + "=").length());
            }
        }
        throw new IllegalStateException("Cookie not found: " + cookieName);
    }

    private String extractUserIdFromToken(String jwt) throws Exception {
        String[] parts = jwt.split("\\.");
        String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
        Map<String, Object> payload = objectMapper.readValue(payloadJson, new TypeReference<>() {
        });
        Object uid = payload.get("uid");
        assertThat(uid).isNotNull();
        return String.valueOf(uid);
    }
}
