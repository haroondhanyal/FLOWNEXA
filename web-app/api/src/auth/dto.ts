import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
export class RegisterDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
}
export class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
}
