# Pre-requiste of the following tools to run the project successfully
1. Docker
2. Nvidia container toolkit
3. git, curl, wget

# steps to setup the project

cd docker and run sudo ./start.sh

# Backend setup

cd backend and run python download_models.py
uv run python ./scripts/cli.py dev

# Frontned

cd frontned and run npm run dev
