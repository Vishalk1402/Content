FROM node:22-bookworm

# Install Python and system dependencies required by edge-tts.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node dependencies first for better Docker layer caching.
COPY package*.json ./
RUN npm ci --omit=dev

# Install Python dependencies.
COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Copy application source.
COPY . .

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PYTHON_BIN=python3

EXPOSE 10000

CMD ["npm", "start"]