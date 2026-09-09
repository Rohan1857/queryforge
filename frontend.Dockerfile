# =============================================================================
# frontend.Dockerfile — Multi-stage production build for Prompt BI frontend
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Build — install deps and compile the Vite/React application
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests first to leverage Docker layer caching
COPY frontend/package.json frontend/package-lock.json* ./

# Install dependencies using clean install for reproducible builds
RUN npm ci

# Copy the rest of the frontend source code
COPY frontend/ .

# Build the production bundle (outputs to /app/dist)
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: Serve — lightweight Nginx to serve the static SPA
# ---------------------------------------------------------------------------
FROM nginx:alpine AS prod

# Remove the default Nginx site configuration
RUN rm -rf /usr/share/nginx/html/*

# Copy the built static assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy the custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Nginx runs in the foreground by default with the official image's CMD
