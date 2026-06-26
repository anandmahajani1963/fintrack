docker compose down
docker compose build --no-cache
docker compose up -d
sleep 60
docker compose ps

