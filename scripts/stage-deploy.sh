#!/bin/bash
# Деплой стенда stage.scheglove.ru (на сервере прода, рядом с продом).
# Раскладка на сервере: /root/stage/{repo/, docker-compose.stage.yml, .env.stage}
#   repo/ — отдельный клон этого репозитория (ветка main), прод в /root/zakupki не трогается.
# Запуск на сервере: /root/stage/build.sh  (копия этого скрипта)
# Подтягивает main, собирает образ zakupki-frontend:stage, накатывает миграции на базу стенда
# и перезапускает только frontend-stage.
set -euo pipefail
cd /root/stage
git -C repo pull -q --ff-only
set -a; . ./.env.stage; set +a
ARGS=(--build-arg NEXT_PUBLIC_VK_APP_ID="$NEXT_PUBLIC_VK_APP_ID" --build-arg NEXT_PUBLIC_VK_REDIRECT_URL="$NEXT_PUBLIC_VK_REDIRECT_URL" --build-arg NEXT_PUBLIC_TELEGRAM_BOT_ID="$NEXT_PUBLIC_TELEGRAM_BOT_ID" --build-arg NEXT_PUBLIC_BOT_USERNAME="$NEXT_PUBLIC_BOT_USERNAME")
docker build -f repo/apps/frontend/Dockerfile "${ARGS[@]}" --target builder -t zakupki-frontend:stage-builder repo
docker build -f repo/apps/frontend/Dockerfile "${ARGS[@]}" -t zakupki-frontend:stage repo
docker run --rm --network zakupki-stage -e DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@postgres-stage:5432/$POSTGRES_DB?schema=public" zakupki-frontend:stage-builder pnpm --filter @zakupki/database prisma:deploy
docker compose -f docker-compose.stage.yml --env-file .env.stage up -d --force-recreate frontend-stage
echo BUILD_DONE
