package com.nova.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneOffset;

@Service
public class TimezoneResolverService {

    private static final Logger logger = LoggerFactory.getLogger(TimezoneResolverService.class);

    public LocalDate resolveToday(String timezoneOffsetHeader) {
        if (timezoneOffsetHeader == null || timezoneOffsetHeader.isBlank()) {
            logger.warn("Missing X-Timezone-Offset header on log request. Falling back to UTC for date validation.");
            return LocalDate.now(ZoneOffset.UTC);
        }

        try {
            ZoneOffset zoneOffset = ZoneOffset.of(timezoneOffsetHeader.trim());
            return LocalDate.now(zoneOffset);
        } catch (Exception ex) {
            logger.warn("Invalid X-Timezone-Offset '{}' on log request. Falling back to UTC for date validation.", timezoneOffsetHeader);
            return LocalDate.now(ZoneOffset.UTC);
        }
    }
}
