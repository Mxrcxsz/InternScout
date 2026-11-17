# Playwright's image ships Node + Chromium + all its system libraries.
# Keep this tag in sync with the playwright version in pnpm-lock.yaml.
FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app
ENV NODE_ENV=production

RUN npm install -g pnpm@9
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY . .

EXPOSE 10000
CMD ["node", "server.js"]
