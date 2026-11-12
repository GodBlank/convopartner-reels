#!/bin/zsh
# make.sh <episode-id> [minimax|eleven|gemini|say] — Mac/Linux shortcut for tools/make.py
cd "$(dirname "$0")/.." && exec python3 tools/make.py "$@"
