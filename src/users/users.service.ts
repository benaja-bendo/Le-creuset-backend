import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

  async updateStatus(id: string, status: 'PENDING' | 'ACTIVE' | 'REJECTED') {
    if (status === 'REJECTED') {
      return this.prisma.user.delete({ where: { id } });
    }
    return this.prisma.user.update({ where: { id }, data: { status } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
