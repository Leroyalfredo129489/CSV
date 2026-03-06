# Usar Node como base
FROM node:20-slim

WORKDIR /app

# Instalar dependencias de Node
COPY package*.json ./
RUN npm install --production

# Copiar el resto del código
COPY . .

# Railway usa la variable PORT automáticamente
ENV PORT=3000

# Crear script de arranque dual
RUN echo "#!/bin/bash\n./venv/bin/python detonator.py & \nnpm start" > start.sh && chmod +x start.sh

CMD ["./start.sh"]
