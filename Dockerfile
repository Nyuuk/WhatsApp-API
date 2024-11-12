FROM node:20.16.0 AS builder

# RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

COPY . /app/

RUN npm install

RUN npm run prisma:generate

RUN npm run build

FROM node:20.16.0 AS runner

RUN apt-get update -y && apt-get install -y openssl net-tools curl

WORKDIR /app

COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/prisma /app/prisma
COPY .env /app/.env

RUN rm -fr /etc/localtime && ln -s /usr/share/zoneinfo/Asia/Jakarta /etc/localtime
RUN echo "Asia/Jakarta" >  /etc/timezone
RUN date

# RUN ls /app

# ENTRYPOINT ["npm", "run", "start"]
CMD ["npm", "run"]
