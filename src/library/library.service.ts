import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUser(userId: string) {
    return this.prisma.libraryFile.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findAll() {
    return this.prisma.libraryFile.findMany({
      include: {
        user: {
          select: { id: true, email: true, companyName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(data: {
    userId: string;
    name: string;
    reference?: string;
    fileUrl: string;
    notes?: string;
  }) {
    return this.prisma.libraryFile.create({ data });
  }

  async update(
    id: string,
    data: { name?: string; reference?: string; notes?: string },
  ) {
    return this.prisma.libraryFile.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.libraryFile.delete({ where: { id } });
  }
}
