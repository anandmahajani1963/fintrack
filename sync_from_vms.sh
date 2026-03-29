#!/bin/bash
echo "Date: `date`"
echo "Syncing from API VM..."
rsync -avz --exclude='.git' --exclude='__pycache__' --exclude='*.pyc' \
    fintrack@192.168.1.170:~/fintrack/backend/ ~/fintrack/backend/

echo "Syncing from DB VM..."
rsync -avz --exclude='.git' --exclude='__pycache__' --exclude='*.pyc' \
    fintrack@192.168.1.169:~/fintrack/database/ ~/fintrack/database/

echo "Done. Ready to git add/commit/push."
