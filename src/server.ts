import app from "./app";
import * as dotenv from "dotenv";

dotenv.config();

const port = process.env.API_PORT || 3000;

app.listen(port, () => {
  console.log(`🚀 API rodando na porta ${port}`);
  console.log(`📡 Health check: http://localhost:${port}/health`);
});