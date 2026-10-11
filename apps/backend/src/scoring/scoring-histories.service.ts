import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryScoringHistoriesDto } from './dto/query-scoring-histories.dto';

@Injectable()
export class ScoringHistoriesService {
  constructor(private prisma: PrismaService) {}

  findAll(query: QueryScoringHistoriesDto) {
    return this.prisma.scoringHistory.findMany({
      where: {
        tenderId: query.tender_id,
        status: query.status,
      },
      include: { tender: { select: { id: true, title: true } } },
      orderBy: { startedAt: 'desc' },
    });
  }

  async findOneOrThrow(id: string) {
    const history = await this.prisma.scoringHistory.findUnique({
      where: { id },
      include: { tender: { select: { id: true, title: true } } },
    });
    if (!history) {
      throw new NotFoundException('Scoring history not found');
    }
    return history;
  }
}
