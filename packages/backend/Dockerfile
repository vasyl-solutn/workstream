FROM node:18-alpine as builder

WORKDIR /app
COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

RUN yarn install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend

# Use direct paths instead of workspace names
RUN cd packages/shared && yarn build
RUN cd packages/backend && yarn build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/package.json /app/yarn.lock ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/backend/package.json ./packages/backend/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

ENV NODE_ENV=production
RUN yarn install --frozen-lockfile --production

EXPOSE 8080
CMD ["node", "packages/backend/dist/index.js"]
