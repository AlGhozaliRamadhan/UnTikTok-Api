# Use the official Playwright image which includes Node.js and all browser dependencies.
# The base image version MUST match the playwright npm driver version — see ADR-004
# and scripts/check-playwright-version.mjs (runs in CI to catch drift).
FROM mcr.microsoft.com/playwright:v1.61.1-jammy

# Set the working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install npm dependencies
RUN npm ci

# Copy project files
COPY . .

# Build the TypeScript project
RUN npm run build

# Default command (can be overridden)
CMD ["node", "dist/index.js"]
