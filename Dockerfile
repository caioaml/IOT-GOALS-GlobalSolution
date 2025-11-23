# Usar Node.js 18 Alpine (mais leve)
FROM node:18-alpine

# Definir diretório de trabalho
WORKDIR /app

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código fonte
COPY . .

# Compilar TypeScript
RUN npm run build

# Expor porta
EXPOSE 10000

# Variável de ambiente padrão
ENV PORT=10000
ENV NODE_ENV=production

# Comando para iniciar
CMD ["node", "dist/app.js"]
```

---

## 📄 Criar `.dockerignore` (na raiz do projeto)
```
node_modules
npm-debug.log
.env
.git
.gitignore
README.md
.vscode
.DS_Store
dist
*.md
docs/
