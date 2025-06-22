# Use an official Node runtime as a parent image
FROM node:lts-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock if you use yarn)
# Copying these first leverages Docker cache if dependencies haven't changed
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of the application code into the container
# This will be overwritten by the volume mount in docker-compose for development,
# but is useful if you build the image without volumes later.
COPY . .

# Vite's default development port
EXPOSE 5173

# Command to run the Vite development server
# Ensure your package.json's "dev" script includes '--host' flag
# e.g., "dev": "vite --host"
CMD ["npm", "run", "dev"]