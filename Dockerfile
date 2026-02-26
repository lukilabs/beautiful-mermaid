# ── Stage 1: Build ────────────────────────────────────────────────────────
# Uses the official Bun Alpine image to install deps and build all HTML output.
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy lockfile + manifest first so this layer is cached between source changes
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy all source files
COPY . .

# Build both the samples demo (dist/index.html) and the editor (dist/editor.html)
RUN bun run build:all

# ── Stage 2: Serve ────────────────────────────────────────────────────────
# The final image is nginx:alpine (~10 MB).
# Only the static dist/ output is copied — no Bun, no node_modules.
FROM nginx:alpine AS server

# Remove the default nginx placeholder content
RUN rm -rf /usr/share/nginx/html/*

# Copy built HTML + assets
COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=builder /app/public /usr/share/nginx/html

# Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
