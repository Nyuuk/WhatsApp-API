FROM node:20.16.0

RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

COPY . /app/

RUN npm install

RUN npm run prisma:migrate

RUN npm run prisma:generate

RUN npm run build

# RUN cp /app/.env.local-example /app/.env


RUN rm -fr /etc/localtime && ln -s /usr/share/zoneinfo/Asia/Jakarta /etc/localtime
RUN echo "Asia/Jakarta" >  /etc/timezone
RUN date

RUN ls /app

# ENTRYPOINT ["npm", "run", "start"]
ENTRYPOINT ["npm", "run", "start"]
