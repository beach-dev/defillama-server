# Use the official Node.js base image
FROM node:18

# Set the working directory inside the container
WORKDIR /app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install project dependencies
RUN npm install

RUN npm install -g ts-node

# Copy the rest of the project files
COPY . .

# Specify the command to run your Node.js application
ENTRYPOINT ["tail", "-f", "/dev/null"]