#!/bin/sh

# Start Ollama server in background
echo "Starting Ollama server..."
ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to be ready
echo "Waiting for Ollama server to be ready..."
for i in $(seq 1 60); do
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "Ollama server is ready!"
        break
    fi
    echo "Waiting... ($i/60)"
    sleep 2
done

# Pull models specified in environment variable
if [ -n "$OLLAMA_MODELS" ]; then
    echo "Pulling models: $OLLAMA_MODELS"
    IFS=','
    for model in $OLLAMA_MODELS; do
        model=$(echo "$model" | xargs)
        if [ -n "$model" ]; then
            echo "Pulling model: $model"
            retry=0
            until [ $retry -ge 3 ]; do
                if ollama pull "$model"; then
                    echo "✓ Model $model pulled successfully"
                    break
                fi
                retry=$((retry + 1))
                echo "Retry $retry/3 for $model..."
                sleep 5
            done
        fi
    done
    unset IFS
    echo "Model pulling complete!"
else
    echo "No models specified (set OLLAMA_MODELS environment variable)"
fi

# Keep the container running
echo "Ollama is running. PID: $OLLAMA_PID"
wait $OLLAMA_PID
