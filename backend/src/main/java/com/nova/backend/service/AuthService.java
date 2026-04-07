package com.nova.backend.service;

import com.nova.backend.dto.LoginRequest;
import com.nova.backend.dto.RegisterRequest;
import com.nova.backend.entity.User;
import com.nova.backend.exception.BadRequestException;
import com.nova.backend.exception.UnauthorizedException;
import com.nova.backend.repository.UserRepository;
import com.nova.backend.security.JwtUtil;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    public String register(RegisterRequest request) {
        String normalizedEmail = request.email().trim().toLowerCase();
        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new BadRequestException("Email already registered.");
        }

        User user = new User();
        user.setEmail(normalizedEmail);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setTimezone(request.timezone() == null || request.timezone().isBlank() ? null : request.timezone().trim());

        User savedUser;
        try {
            savedUser = userRepository.save(user);
        } catch (DataIntegrityViolationException ex) {
            throw new BadRequestException("Email already registered.");
        }

        return jwtUtil.generateToken(savedUser.getId(), savedUser.getEmail());
    }

    public String login(LoginRequest request) {
        String normalizedEmail = request.email().trim().toLowerCase();
        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new UnauthorizedException("Invalid email or password."));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new UnauthorizedException("Invalid email or password.");
        }

        return jwtUtil.generateToken(user.getId(), user.getEmail());
    }
}
