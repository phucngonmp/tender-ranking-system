import { IsIn } from 'class-validator';

export class MoveDto {
  @IsIn(['up', 'down'])
  direction: 'up' | 'down';
}
