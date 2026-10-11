import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCriteriaProfileDto } from './dto/create-criteria-profile.dto';
import { UpdateCriteriaProfileDto } from './dto/update-criteria-profile.dto';

@Injectable()
export class CriteriaProfilesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.criteriaProfile.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  async findOneOrThrow(id: string) {
    const profile = await this.prisma.criteriaProfile.findUnique({ where: { id } });
    if (!profile) {
      throw new NotFoundException('Criteria profile not found');
    }
    return profile;
  }

  getActiveProfile() {
    return this.prisma.criteriaProfile.findFirst({ where: { isActive: true } });
  }

  create(dto: CreateCriteriaProfileDto, updatedBy: string) {
    return this.prisma.criteriaProfile.create({
      data: { ...dto, updatedBy },
    });
  }

  async update(id: string, dto: UpdateCriteriaProfileDto, updatedBy: string) {
    await this.findOneOrThrow(id);
    return this.prisma.criteriaProfile.update({
      where: { id },
      data: { ...dto, updatedBy },
    });
  }

  async remove(id: string) {
    await this.findOneOrThrow(id);
    await this.prisma.criteriaProfile.delete({ where: { id } });
    return { success: true };
  }

  async activate(id: string) {
    await this.findOneOrThrow(id);
    return this.prisma.$transaction(async (tx) => {
      await tx.criteriaProfile.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
      return tx.criteriaProfile.update({
        where: { id },
        data: { isActive: true },
      });
    });
  }
}
