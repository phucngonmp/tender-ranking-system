import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { RoleName } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsEnum(RoleName)
  role?: RoleName;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
