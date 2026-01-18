import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

function hashPassword(password: string, salt: string): string {
  const derived = scryptSync(password, salt, 32);
  return `${salt}:${derived.toString('hex')}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hex] = stored.split(':');
  const derived = scryptSync(password, salt, 32).toString('hex');
  return timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(hex, 'hex'));
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new UnauthorizedException('Email déjà utilisé');
    const salt = randomBytes(16).toString('hex');
    const passwordHash = hashPassword(dto.password, salt);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: 'CLIENT',
        status: 'PENDING',
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
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Identifiants invalides');
    if (!verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Identifiants invalides');
    }
    if (user.status === 'REJECTED') {
      throw new ForbiddenException('Compte rejeté');
    }
    const token = `dev-${user.id}`;
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        companyName: user.companyName,
      },
    };
  }
}
