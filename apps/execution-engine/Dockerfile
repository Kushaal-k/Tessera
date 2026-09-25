FROM node:26-bookworm-slim

# Avoid tzdata interactive prompt during apt install
ENV DEBIAN_FRONTEND=noninteractive

# Install g++, python3, and other essential tools
RUN apt-get update && apt-get upgrade -y && apt-get install -y \
    g++ \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Update npm to the latest version to patch nested vulnerabilities (cross-spawn, glob, minimatch, tar)
RUN npm install -g npm@latest

# Set up a non-root sandbox user for secure execution
RUN useradd -m -s /bin/bash sandbox
USER sandbox
WORKDIR /home/sandbox

# Default command
CMD ["bash"]
