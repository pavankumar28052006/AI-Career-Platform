# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Serve stage
FROM node:20-alpine

WORKDIR /app

# Install a simple static server
RUN npm install -g serve

# Copy build output from build stage
COPY --from=build /app/dist ./dist

# Expose port 5173
EXPOSE 5173

# Serve the static files
CMD ["serve", "-s", "dist", "-l", "5173"]
