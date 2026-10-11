import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { RoleName } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  fullName: string;

  @IsEnum(RoleName)
  role: RoleName;
}
