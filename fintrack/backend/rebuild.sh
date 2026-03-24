docker compose down
docker compose build --no-cache
docker compose up -d
sleep 20
docker compose ps

