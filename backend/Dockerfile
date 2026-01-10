FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src ./src
COPY blacklist.txt ./

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Run the application
CMD ["node", "dist/index.js"]
