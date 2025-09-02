# Dockerfile for whisper.cpp service
FROM ubuntu:22.04

# Install dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    pkg-config \
    wget \
    curl \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Clone and build whisper.cpp
WORKDIR /app
RUN git clone https://github.com/ggml-org/whisper.cpp.git
WORKDIR /app/whisper.cpp

# Build whisper.cpp with optimizations for CPU
RUN make -j$(nproc) \
    CFLAGS="-O3 -march=native -mtune=native" \
    CXXFLAGS="-O3 -march=native -mtune=native"

# Download models
RUN bash ./models/download-ggml-model.sh base.en
RUN bash ./models/download-ggml-model.sh small.en  
RUN bash ./models/download-ggml-model.sh medium.en
RUN bash ./models/download-ggml-model.sh large-v2

# Install Python dependencies for HTTP server
RUN pip3 install fastapi uvicorn python-multipart aiofiles

# Create HTTP API wrapper
COPY whisper_api.py /app/whisper_api.py

WORKDIR /app

# Create models directory and move models
RUN mkdir -p /app/models && \
    cp /app/whisper.cpp/models/ggml-*.bin /app/models/

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Start the API server
CMD ["python3", "whisper_api.py"]
