package com.travel.ai.config;

import com.travel.ai.security.JwtInterceptor;
import com.travel.ai.security.OptionalJwtInterceptor;
import java.util.List;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@EnableConfigurationProperties(AppProperties.class)
public class WebConfig implements WebMvcConfigurer {
  private final JwtInterceptor jwtInterceptor;
  private final OptionalJwtInterceptor optionalJwtInterceptor;
  private final AppProperties properties;
  public WebConfig(JwtInterceptor jwtInterceptor, OptionalJwtInterceptor optionalJwtInterceptor, AppProperties properties) {
    this.jwtInterceptor = jwtInterceptor; this.optionalJwtInterceptor = optionalJwtInterceptor; this.properties = properties;
  }
  @Override public void addInterceptors(InterceptorRegistry registry) {
    registry.addInterceptor(jwtInterceptor).addPathPatterns("/api/itinerary/**", "/api/auth/profile", "/api/auth/preferences", "/api/auth/change-password", "/api/chat/sessions/**");
    registry.addInterceptor(optionalJwtInterceptor).addPathPatterns("/api/travel/recommend", "/api/travel/swap", "/api/chat/completions");
  }
  @Override public void addCorsMappings(CorsRegistry registry) {
    registry.addMapping("/api/**").allowedOrigins(List.of(properties.corsOrigin()).toArray(String[]::new))
        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS").allowedHeaders("*").allowCredentials(true);
  }
}
