# Use the official Playwright image which includes Node.js and all browser dependencies
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

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
