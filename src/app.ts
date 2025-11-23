import express from "express";
import path from "path";
import routes from "./routes";
import * as dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(express.json());

// ✅ Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, '../public')));

// Rotas da API
app.use(routes);

export default app;