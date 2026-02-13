#!/bin/bash

# Add current user to docker group
echo "Adding user to docker group..."

# Get current user
CURRENT_USER=${1:-$USER}

# Add user to docker group
sudo usermod -aG docker "$CURRENT_USER"

echo "✓ User '$CURRENT_USER' added to docker group"
echo ""
echo "IMPORTANT: You must log out and log back in for changes to take effect!"
echo ""
echo "Or run: newgrp docker"
