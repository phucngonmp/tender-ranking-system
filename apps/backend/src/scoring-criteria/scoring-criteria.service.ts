import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScoringCriteriaGroupDto } from './dto/create-group.dto';
import { UpdateScoringCriteriaGroupDto } from './dto/update-group.dto';
import { CreateScoringCriteriaTierDto } from './dto/create-tier.dto';
import { UpdateScoringCriteriaTierDto } from './dto/update-tier.dto';
import { ALLOWED_AI_QUESTION_KEYS, ALLOWED_TARGET_FIELDS } from './scoring-criteria.constants';

@Injectable()
export class ScoringCriteriaService {
  constructor(private prisma: PrismaService) {}

  fieldMetadata() {
    return { targetFields: ALLOWED_TARGET_FIELDS, aiQuestionKeys: ALLOWED_AI_QUESTION_KEYS };
  }

  findAllGroups() {
    return this.prisma.scoringCriteriaGroup.findMany({
      orderBy: { order: 'asc' },
      include: { tiers: { orderBy: { order: 'asc' } } },
    });
  }

  async createGroup(dto: CreateScoringCriteriaGroupDto) {
    const maxOrder = await this.prisma.scoringCriteriaGroup.aggregate({ _max: { order: true } });
    return this.prisma.scoringCriteriaGroup.create({
      data: { ...dto, order: (maxOrder._max.order ?? -1) + 1 },
      include: { tiers: true },
    });
  }

  async updateGroup(id: string, dto: UpdateScoringCriteriaGroupDto) {
    await this.findGroupOrThrow(id);
    return this.prisma.scoringCriteriaGroup.update({
      where: { id },
      data: dto,
      include: { tiers: { orderBy: { order: 'asc' } } },
    });
  }

  async deleteGroup(id: string) {
    await this.findGroupOrThrow(id);
    await this.prisma.scoringCriteriaGroup.delete({ where: { id } });
    return { success: true };
  }

  async moveGroup(id: string, direction: 'up' | 'down') {
    const groups = await this.prisma.scoringCriteriaGroup.findMany({ orderBy: { order: 'asc' } });
    const idx = groups.findIndex((g) => g.id === id);
    if (idx === -1) throw new NotFoundException('Group not found');

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx >= 0 && swapIdx < groups.length) {
      const a = groups[idx];
      const b = groups[swapIdx];
      await this.prisma.$transaction([
        this.prisma.scoringCriteriaGroup.update({ where: { id: a.id }, data: { order: b.order } }),
        this.prisma.scoringCriteriaGroup.update({ where: { id: b.id }, data: { order: a.order } }),
      ]);
    }
    return this.findAllGroups();
  }

  async createTier(groupId: string, dto: CreateScoringCriteriaTierDto) {
    await this.findGroupOrThrow(groupId);
    const maxOrder = await this.prisma.scoringCriteriaTier.aggregate({
      where: { groupId },
      _max: { order: true },
    });
    return this.prisma.scoringCriteriaTier.create({
      data: { ...dto, config: (dto.config ?? {}) as any, groupId, order: (maxOrder._max.order ?? -1) + 1 },
    });
  }

  async updateTier(id: string, dto: UpdateScoringCriteriaTierDto) {
    await this.findTierOrThrow(id);
    return this.prisma.scoringCriteriaTier.update({ where: { id }, data: dto as any });
  }

  async deleteTier(id: string) {
    await this.findTierOrThrow(id);
    await this.prisma.scoringCriteriaTier.delete({ where: { id } });
    return { success: true };
  }

  async moveTier(id: string, direction: 'up' | 'down') {
    const tier = await this.findTierOrThrow(id);
    const siblings = await this.prisma.scoringCriteriaTier.findMany({
      where: { groupId: tier.groupId },
      orderBy: { order: 'asc' },
    });
    const idx = siblings.findIndex((t) => t.id === id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx >= 0 && swapIdx < siblings.length) {
      const a = siblings[idx];
      const b = siblings[swapIdx];
      await this.prisma.$transaction([
        this.prisma.scoringCriteriaTier.update({ where: { id: a.id }, data: { order: b.order } }),
        this.prisma.scoringCriteriaTier.update({ where: { id: b.id }, data: { order: a.order } }),
      ]);
    }
    return this.prisma.scoringCriteriaGroup.findUnique({
      where: { id: tier.groupId },
      include: { tiers: { orderBy: { order: 'asc' } } },
    });
  }

  private async findGroupOrThrow(id: string) {
    const group = await this.prisma.scoringCriteriaGroup.findUnique({ where: { id } });
    if (!group) throw new NotFoundException('Scoring criteria group not found');
    return group;
  }

  private async findTierOrThrow(id: string) {
    const tier = await this.prisma.scoringCriteriaTier.findUnique({ where: { id } });
    if (!tier) throw new NotFoundException('Scoring criteria tier not found');
    return tier;
  }
}
