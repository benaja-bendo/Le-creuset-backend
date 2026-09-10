import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger("Bootstrap");

  // L'app tourne derrière Traefik en prod (DEPLOYMENT.md) : sans ceci,
  // req.ip vaut l'IP interne de Traefik pour toutes les requêtes, et le
  // rate-limiting (ThrottlerModule) s'appliquerait à tout le monde à la
  // fois au lieu d'IP par IP. `1` = faire confiance au premier hop
  // (Traefik), pas plus loin.
  app.set("trust proxy", 1);

  // Enable CORS
  app.enableCors({
    origin: configService.get<string>("CORS_ORIGIN", "*"),
    credentials: true,
  });

  // Global prefix for API routes
  app.setGlobalPrefix("api");

  const port = configService.get<number>("PORT", 3000);
  await app.listen(port);

  logger.log(`🚀 Application is running on: http://localhost:${port}/api`);
}

bootstrap();
