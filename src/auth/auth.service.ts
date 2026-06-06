import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

function hashPassword(password: string, salt: string): string {
  const derived = scryptSync(password, salt, 32);
  return `${salt}:${derived.toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hex] = stored.split(":");
    if (!salt || !hex) return false;
    const derived = scryptSync(password, salt, 32).toString("hex");
    const derivedBuf = Buffer.from(derived, "hex");
    const storedBuf = Buffer.from(hex, "hex");

    if (derivedBuf.length !== storedBuf.length) {
      return false;
    }
    return timingSafeEqual(derivedBuf, storedBuf);
  } catch (_error) {
    return false;
  }
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async generatePasswordResetLink(email: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return null;

    const payload = { sub: user.id, email: user.email };
    const secret =
      this.configService.get<string>("JWT_SECRET") + user.passwordHash;

    const token = this.jwtService.sign(payload, {
      secret,
      expiresIn: "1h",
    });

    const frontendUrl = this.configService.get<string>(
      "FRONTEND_URL",
      "http://localhost:5173",
    );
    return `${frontendUrl}/reset?token=${token}`;
  }

  async resetPassword(token: string, newPassword: string) {
    if (!token || !newPassword) {
      throw new BadRequestException("Token et nouveau mot de passe requis");
    }

    try {
      // Decode token without verification to get user ID
      const decoded = this.jwtService.decode(token) as any;
      if (!decoded || !decoded.sub) {
        throw new BadRequestException("Token invalide");
      }

      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
      });
      if (!user) throw new BadRequestException("Token invalide");

      // Verify token with user's current password
      const secret =
        this.configService.get<string>("JWT_SECRET") + user.passwordHash;
      this.jwtService.verify(token, { secret });

      // Update password
      const salt = randomBytes(16).toString("hex");
      const hashedPassword = hashPassword(newPassword, salt);

      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashedPassword },
      });

      return true;
    } catch (_err) {
      throw new BadRequestException("Lien expiré ou invalide");
    }
  }

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new UnauthorizedException("Email déjà utilisé");
    const salt = randomBytes(16).toString("hex");
    const passwordHash = hashPassword(dto.password, salt);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: "CLIENT",
        status: "PENDING",
        companyName: dto.companyName,
        phone: dto.phone,
        address: dto.address,
        kbisFileUrl: dto.kbisFileUrl,
        customsFileUrl: dto.customsFileUrl,
      },
    });
    return { id: user.id, status: user.status };
  }

  async login(dto: LoginDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (!user) throw new UnauthorizedException("Identifiants invalides");
      if (!verifyPassword(dto.password, user.passwordHash)) {
        throw new UnauthorizedException("Identifiants invalides");
      }
      if (user.status === "REJECTED") {
        throw new ForbiddenException("Compte rejeté");
      }
      if (user.status === "SUSPENDED") {
        throw new ForbiddenException(
          "Compte désactivé. Veuillez contacter La Grenaille.",
        );
      }

      const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      };

      return {
        token: this.jwtService.sign(payload),
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
          companyName: user.companyName,
        },
      };
    } catch (error) {
      console.error("Login Error:", error);
      throw error;
    }
  }
}
