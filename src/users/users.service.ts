import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateDocumentsDto } from './dto/update-documents.dto';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { WeightsService } from '../weights/weights.service';
import { UserStatus } from '@prisma/client';

function hashPassword(password: string, salt: string): string {
  const derived = scryptSync(password, salt, 32);
  return `${salt}:${derived.toString('hex')}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hex] = stored.split(':');
  if (!salt || !hex) return false;
  const derived = scryptSync(password, salt, 32).toString('hex');
  return timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(hex, 'hex'));
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly weightsService: WeightsService,
  ) {}

  async register(dto: CreateUserDto) {
    return this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash: `disabled:${randomBytes(16).toString('hex')}`,
        role: 'CLIENT',
        status: 'PENDING',
        companyName: dto.companyName,
        phone: dto.phone,
        address: dto.address,
        kbisFileUrl: dto.kbisFileUrl,
        customsFileUrl: dto.customsFileUrl,
      },
    });
  }

  async findPending() {
    return this.prisma.user.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        companyName: true,
        phone: true,
        createdAt: true,
      },
    });
  }

  async updateStatus(id: string, status: UserStatus) {
    if (status === 'REJECTED') {
      return this.prisma.user.delete({ where: { id } });
    }
    
    const user = await this.prisma.user.update({ where: { id }, data: { status } });
    
    if (status === 'ACTIVE') {
      await this.weightsService.initializeUserAccounts(id);
    }
    
    return user;
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /**
   * Get full profile for current user (excluding password)
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        companyName: true,
        phone: true,
        address: true,
        kbisFileUrl: true,
        customsFileUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new UnauthorizedException('Utilisateur non trouvé');
    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name,
        companyName: dto.companyName,
        phone: dto.phone,
        address: dto.address,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        companyName: true,
        phone: true,
        address: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, dto: UpdatePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Utilisateur non trouvé');

    // Verify current password
    if (!verifyPassword(dto.currentPassword, user.passwordHash)) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }

    // Hash new password
    const salt = randomBytes(16).toString('hex');
    const newPasswordHash = hashPassword(dto.newPassword, salt);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return { success: true, message: 'Mot de passe mis à jour avec succès' };
  }

  /**
   * Update legal documents (KBIS/Customs)
   */
  async updateDocuments(userId: string, dto: UpdateDocumentsDto) {
    const updateData: { kbisFileUrl?: string; customsFileUrl?: string } = {};
    
    if (dto.kbisFileUrl) updateData.kbisFileUrl = dto.kbisFileUrl;
    if (dto.customsFileUrl) updateData.customsFileUrl = dto.customsFileUrl;

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        kbisFileUrl: true,
        customsFileUrl: true,
        updatedAt: true,
      },
    });
  }
}
