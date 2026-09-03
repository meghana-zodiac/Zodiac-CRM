# Cloud Run image serving the TanStack Start SSR server (.output/server)
# Built with: NITRO_PRESET=node bun run build
FROM node:20-slim

WORKDIR /app

# Nitro emits a fully bundled, dependency-free server output
COPY .output ./.output

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", ".output/server/index.mjs"]
