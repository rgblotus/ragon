#!/bin/bash

echo "Restarting all Rage containers..."

sudo docker restart \
    neo-milvus-etcd \
    neo-milvus-minio \
    neo-milvus-standalone \
    neo-postgres \
    neo-redis \
    neo-ollama \
    neo-open-webui \
    neo-nginx \
    neo-pgadmin

echo "All containers restarted!"
